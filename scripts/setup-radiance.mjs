#!/usr/bin/env node
// Descarga e instala Radiance (LBNL-ETA, open-source, licencia BSD) en
// `.radiance/` dentro del repo — para el oráculo de validación de
// `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle/`.
//
// Por qué existe: antes de este script, instalar Radiance era un
// procedimiento manual (README de esa carpeta) que había que repetir en
// cada máquina/checkout — friction real reportada por el usuario ("cada que
// subo al repo tengo que descargar, trabajo en casa y el proyecto y en
// ambos lados he descargado"). `.radiance/` está en `.gitignore` (32 MB de
// binarios, no se versiona) — este script es lo que reemplaza "descargar a
// mano" por "correr un comando", en cualquier máquina.
//
// `runRadianceOracle.ts::resolveBinDir()` ya busca `.radiance/bin` como
// fallback automático si `RADIANCE_BIN_DIR` no está definida — con esto
// instalado una vez por máquina, los tests de `radianceOracle/` funcionan
// sin ninguna variable de entorno que configurar.
//
// Uso: `npm run setup:radiance`. Idempotente — si ya está instalado, no
// vuelve a descargar.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INSTALL_DIR = join(REPO_ROOT, '.radiance');
const BIN_DIR = join(INSTALL_DIR, 'bin');
const RELEASES_API = 'https://api.github.com/repos/LBNL-ETA/Radiance/releases/latest';

function log(message) {
    // eslint-disable-next-line no-console
    console.log(`[setup-radiance] ${message}`);
}

function platformAssetSuffix() {
    switch (process.platform) {
        case 'win32':
            return '_Windows.zip';
        case 'darwin':
            return '_OSX.zip';
        case 'linux':
            return '_Linux.zip';
        default:
            throw new Error(`Plataforma no soportada por este script: ${process.platform}. Instala Radiance manualmente (ver README.md de radianceOracle/).`);
    }
}

function binaryName(name) {
    return process.platform === 'win32' ? `${name}.exe` : name;
}

function alreadyInstalled() {
    return existsSync(join(BIN_DIR, binaryName('oconv'))) && existsSync(join(BIN_DIR, binaryName('rtrace'))) && existsSync(join(BIN_DIR, binaryName('ies2rad')));
}

async function fetchLatestReleaseAssetUrl() {
    const response = await fetch(RELEASES_API, { headers: { 'User-Agent': 'dialux-setup-radiance-script' } });
    if (!response.ok) {
        throw new Error(`No se pudo consultar el release más reciente de Radiance (HTTP ${response.status}). Revisa tu conexión o instala manualmente.`);
    }
    const release = await response.json();
    const suffix = platformAssetSuffix();
    const asset = (release.assets ?? []).find((a) => a.name.endsWith(suffix));
    if (!asset) {
        throw new Error(`No se encontró un asset "${suffix}" en el release ${release.tag_name ?? '(desconocido)'} de Radiance.`);
    }
    return { url: asset.browser_download_url, tagName: release.tag_name };
}

async function downloadTo(url, destPath) {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Descarga falló (HTTP ${response.status}) para ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destPath, buffer);
}

function extractZip(zipPath, destDir) {
    mkdirSync(destDir, { recursive: true });
    if (process.platform === 'win32') {
        execFileSync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`],
            { stdio: 'inherit' },
        );
        return;
    }
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'inherit' });
}

async function main() {
    if (alreadyInstalled()) {
        log(`ya instalado en ${BIN_DIR} — nada que hacer. Borra la carpeta ".radiance/" si quieres forzar una reinstalación.`);
        return;
    }

    log('Radiance no está instalado en este checkout — descargando el build oficial más reciente (LBNL-ETA/Radiance, GitHub Releases)...');
    const { url, tagName } = await fetchLatestReleaseAssetUrl();
    log(`release ${tagName ?? '(desconocido)'}: ${url}`);

    const workDir = mkdtempSync(join(tmpdir(), 'dialux-radiance-setup-'));
    const zipPath = join(workDir, 'radiance.zip');
    try {
        log('descargando (puede tardar 1-2 minutos, ~30 MB)...');
        await downloadTo(url, zipPath);

        log(`extrayendo a ${INSTALL_DIR} ...`);
        rmSync(INSTALL_DIR, { recursive: true, force: true });
        extractZip(zipPath, INSTALL_DIR);

        if (!alreadyInstalled()) {
            throw new Error(
                `La extracción terminó pero no se encontraron los binarios esperados en ${BIN_DIR}. ` +
                    'El release pudo cambiar de estructura interna — revisa manualmente o instala siguiendo el README.md de radianceOracle/.',
            );
        }

        log(`listo. Radiance instalado en ${BIN_DIR}.`);
        log('Los tests de radianceOracle/ lo detectan automáticamente (fallback en resolveBinDir()) — no hace falta configurar RADIANCE_BIN_DIR a mano.');
        log('Para forzar otra instalación de Radiance en su lugar, sigue exportando RADIANCE_BIN_DIR como antes (tiene prioridad sobre este fallback).');
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(`[setup-radiance] ERROR: ${error.message}`);
    process.exitCode = 1;
});
