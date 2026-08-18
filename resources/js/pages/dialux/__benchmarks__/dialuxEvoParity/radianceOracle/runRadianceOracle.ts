import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Fixture, Vertex } from '@/pages/dialux/hooks/types';
import { generateIesFromFixture } from './generateIes';
import { generatePolygonRoomScene, generateRoomScene, type RoomSceneReflectance } from './generateRoomScene';
import { formatSensorGridForRtrace, generatePolygonSensorGrid, generateSensorGrid, type SensorPoint } from './generateSensorGrid';

/**
 * Orquestador del oráculo de validación con Radiance (LBNL) —
 * `planes/plan_cierre_brecha_paridad_dialux_evo.md` §-6. Reemplaza los
 * scripts manuales de esa ronda (bash + ediciones de texto a mano) por algo
 * reproducible por cualquiera del equipo. Ver `README.md` de esta carpeta
 * para instalar Radiance antes de usar esto.
 *
 * Constante de conversión W/m² → lux: 179 (lm/W), la eficacia luminosa
 * fotópica estándar que asume Radiance/`ies2rad` para fuentes fotométricas
 * — validado empíricamente en la Ronda 6 comparando el resultado de luz
 * directa (sin rebotes) contra `calculateLightingResult` del motor propio
 * (1.9% y 4.7% de diferencia en los dos casos probados).
 *
 * TODO ES ASÍNCRONO A PROPÓSITO (`execFile` + `promisify`, nunca
 * `execFileSync`): la corrida con reflexión completa (`rtrace -ab 8`) tarda
 * 60-150+ segundos por ambiente. Una versión síncrona bloquea el hilo
 * principal de Node por ese tiempo — dentro de un test de Vitest, eso
 * también bloquea el canal de reporte del test runner (que corre en el
 * mismo hilo), así que el test parece "colgado" sin ninguna salida durante
 * todo ese tiempo, aunque en realidad esté progresando bien (descubierto al
 * implementar esto por primera vez — ver el commit/historial de esta
 * carpeta). Con `execFile` asíncrono, el event loop de Node queda libre
 * mientras el binario corre, así que Vitest puede seguir reportando
 * progreso y aplicando sus propios timeouts normalmente.
 */
const RADIANCE_LUMINOUS_EFFICACY = 179;
const execFileAsync = promisify(execFile);

export interface RadianceOracleRoom {
    width: number;
    depth: number;
    height: number;
    workingPlaneHeight: number;
    marginalZone: number;
    reflectance: RoomSceneReflectance;
}

export interface RadianceOracleFixturePlacement {
    fixture: Fixture;
    /** Metadata para las cabeceras del IES generado — no afecta el cálculo. */
    label: string;
    manufacturer: string;
    articleNumber: string;
    provenanceNote: string;
}

export interface RadianceOracleOptions {
    room: RadianceOracleRoom;
    fixtures: RadianceOracleFixturePlacement[];
    /** Espaciado objetivo entre sensores, en metros — misma convención que `GRID_SPACING` de producción (ver Ronda 21 en `generateSensorGrid.ts`). */
    spacing: number;
    /** Rebotes ambientales para el cálculo con reflexión (`rtrace -ab`). Default 8. */
    ambientBounces?: number;
    /** Timeout por invocación de binario, en ms. Default 360000 (6 min) — la corrida con reflexión completa (`-ab 8`) es la más lenta y su duración varía con la carga de la máquina; medido entre 100s y 180s+ en pruebas reales. */
    timeoutMs?: number;
}

export interface RadianceOracleResult {
    directLux: number;
    fullReflectionLux: number;
    sensorCount: number;
}

function resolveBinDir(): string {
    const configured = process.env.RADIANCE_BIN_DIR;
    if (!configured) {
        throw new Error(
            'RADIANCE_BIN_DIR no está definida. Instala Radiance (ver README.md de esta carpeta) y exporta ' +
                'RADIANCE_BIN_DIR apuntando a su carpeta "bin" antes de correr el oráculo.',
        );
    }
    if (!existsSync(configured)) {
        throw new Error(`RADIANCE_BIN_DIR apunta a una ruta que no existe: ${configured}`);
    }
    return configured;
}

function binaryPath(binDir: string, name: string): string {
    const withExeSuffix = process.platform === 'win32' ? `${name}.exe` : name;
    const full = join(binDir, withExeSuffix);
    if (!existsSync(full)) {
        throw new Error(`No se encontró el binario "${withExeSuffix}" en RADIANCE_BIN_DIR (${binDir}).`);
    }
    return full;
}

function averageIrradianceWm2(rtraceOutput: string): number {
    const rows = rtraceOutput
        .trim()
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
            const [r] = line.trim().split(/\s+/).map(Number);
            return r!;
        });
    if (rows.length === 0) {
        throw new Error('rtrace no devolvió ningún resultado — revisa la escena/grilla de sensores.');
    }
    return rows.reduce((sum, value) => sum + value, 0) / rows.length;
}

/** `execFile` no escribe a stdin por defecto — para pasarle texto (la grilla de sensores a `rtrace`) hay que escribir al stream y cerrarlo. */
async function runWithStdin(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number; input?: string }) {
    const child = execFileAsync(command, args, {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeout,
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'buffer',
    });
    if (options.input !== undefined) {
        child.child.stdin?.end(options.input);
    }
    const { stdout } = await child;
    return stdout.toString();
}

/**
 * Núcleo compartido entre `runRadianceOracle()` (caja rectangular) y
 * `runRadianceOracleForPolygon()` (piso de forma arbitraria) — todo lo que
 * pasa DESPUÉS de tener la escena `.rad` del ambiente y la grilla de
 * sensores ya generadas (IES, posicionamiento de luminarias, `oconv`,
 * `rtrace` directo y con reflexión completa) es idéntico sin importar si el
 * piso es un rectángulo o un polígono de N lados.
 */
async function runRadianceOracleCore(
    roomSceneContent: string,
    sensorPoints: SensorPoint[],
    fixtures: RadianceOracleFixturePlacement[],
    ambientBounces: number,
    timeoutMs: number,
): Promise<RadianceOracleResult> {
    const binDir = resolveBinDir();
    const libDir = join(binDir, '..', 'lib');
    const oconv = binaryPath(binDir, 'oconv');
    const rtrace = binaryPath(binDir, 'rtrace');
    const ies2rad = binaryPath(binDir, 'ies2rad');

    const workDir = mkdtempSync(join(tmpdir(), 'dialux-radiance-oracle-'));
    try {
        const env = { ...process.env, RAYPATH: `.${process.platform === 'win32' ? ';' : ':'}${libDir}` };

        const roomSceneFile = join(workDir, 'room.rad');
        writeFileSync(roomSceneFile, roomSceneContent);

        const lightInstanceFiles: string[] = [];
        for (const [index, placement] of fixtures.entries()) {
            const iesFile = join(workDir, `fixture-${index}.ies`);
            writeFileSync(
                iesFile,
                generateIesFromFixture(placement.fixture, {
                    label: placement.label,
                    manufacturer: placement.manufacturer,
                    articleNumber: placement.articleNumber,
                    provenanceNote: placement.provenanceNote,
                }),
            );

            const radPrefix = `fixture-${index}`;
            await execFileAsync(ies2rad, ['-o', radPrefix, '-p', workDir, iesFile], { cwd: workDir, env, timeout: timeoutMs });

            const radFile = join(workDir, `${radPrefix}.rad`);
            const radContent = readFileSync(radFile, 'utf-8');
            // El sphere generado por ies2rad queda en el origen local (0 0 0) —
            // se reposiciona reemplazando esa línea directamente, mismo
            // enfoque validado a mano en la Ronda 6 (más simple y menos
            // frágil que invocar `xform` para esto).
            const positioned = radContent.replace(
                /^4 0 0 0 ([\d.eE+-]+)$/m,
                `4 ${placement.fixture.x} ${placement.fixture.y} ${placement.fixture.z} $1`,
            );
            if (positioned === radContent) {
                throw new Error(`No se pudo reposicionar la luminaria "${placement.label}" — ies2rad pudo haber cambiado su formato de salida.`);
            }
            writeFileSync(radFile, positioned);
            lightInstanceFiles.push(radFile);
        }

        const octFile = join(workDir, 'scene.oct');
        const { stdout: octContent } = await execFileAsync(oconv, [roomSceneFile, ...lightInstanceFiles], {
            cwd: workDir,
            env,
            timeout: timeoutMs,
            encoding: 'buffer',
            maxBuffer: 64 * 1024 * 1024,
        });
        writeFileSync(octFile, octContent);

        const pointsInput = formatSensorGridForRtrace(sensorPoints);

        const directOutput = await runWithStdin(rtrace, ['-I', '-h', '-ab', '0', octFile], {
            cwd: workDir,
            env,
            timeout: timeoutMs,
            input: pointsInput,
        });
        const fullOutput = await runWithStdin(
            rtrace,
            ['-I', '-h', '-ab', String(ambientBounces), '-ad', '2000', '-as', '200', '-ar', '300', '-aa', '0.05', octFile],
            { cwd: workDir, env, timeout: timeoutMs, input: pointsInput },
        );

        return {
            directLux: averageIrradianceWm2(directOutput) * RADIANCE_LUMINOUS_EFFICACY,
            fullReflectionLux: averageIrradianceWm2(fullOutput) * RADIANCE_LUMINOUS_EFFICACY,
            sensorCount: sensorPoints.length,
        };
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
}

/**
 * Corre el oráculo completo para UN ambiente: genera IES + escena + grilla,
 * ejecuta Radiance (directo y con reflexión completa), y devuelve el
 * promedio en lux. Lanza si `RADIANCE_BIN_DIR` no está configurada — usar
 * `describe.skipIf(!process.env.RADIANCE_BIN_DIR)` en los tests que lo
 * consuman, nunca dejar que un test falle solo porque Radiance no está
 * instalado en esa máquina.
 */
export async function runRadianceOracle(options: RadianceOracleOptions): Promise<RadianceOracleResult> {
    const sensorPoints = generateSensorGrid({
        width: options.room.width,
        depth: options.room.depth,
        workingPlaneHeight: options.room.workingPlaneHeight,
        marginalZone: options.room.marginalZone,
        spacing: options.spacing,
    });

    return runRadianceOracleCore(
        generateRoomScene({ ...options.room }),
        sensorPoints,
        options.fixtures,
        options.ambientBounces ?? 8,
        options.timeoutMs ?? 360_000,
    );
}

export interface RadianceOracleColumnRoom {
    vertices: Vertex[];
    height: number;
    workingPlaneHeight: number;
    marginalZone: number;
    reflectance: RoomSceneReflectance;
}

export interface RadianceOracleForPolygonOptions {
    room: RadianceOracleColumnRoom;
    fixtures: RadianceOracleFixturePlacement[];
    /** Espaciado objetivo entre sensores, en metros (ver `generatePolygonSensorGrid`). */
    spacing: number;
    ambientBounces?: number;
    timeoutMs?: number;
}

/**
 * Igual que `runRadianceOracle()`, para un ambiente de forma ARBITRARIA
 * (polígono de N vértices) — terrenos reales no siempre son rectangulares
 * (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-14). Usa
 * `generatePolygonRoomScene()`/`generatePolygonSensorGrid()` en vez de las
 * variantes rectangulares; todo lo demás (IES, `oconv`, `rtrace`) es
 * exactamente el mismo código (`runRadianceOracleCore`).
 */
export async function runRadianceOracleForPolygon(options: RadianceOracleForPolygonOptions): Promise<RadianceOracleResult> {
    const sensorPoints = generatePolygonSensorGrid({
        vertices: options.room.vertices,
        workingPlaneHeight: options.room.workingPlaneHeight,
        marginalZone: options.room.marginalZone,
        spacing: options.spacing,
    });

    return runRadianceOracleCore(
        generatePolygonRoomScene({ vertices: options.room.vertices, height: options.room.height, reflectance: options.room.reflectance }),
        sensorPoints,
        options.fixtures,
        options.ambientBounces ?? 8,
        options.timeoutMs ?? 360_000,
    );
}
