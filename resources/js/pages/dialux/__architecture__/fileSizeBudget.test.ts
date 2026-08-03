import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Test de arquitectura — presupuesto de tamaño (Fase 0,
 * planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md §4.5/§11).
 *
 * No es un gate mecánico de "todo archivo debe ser corto": los 36 archivos
 * listados en `fileSizeBudget.allowlist.json` YA superaban el umbral al
 * congelar la línea base (2026-08-02) y son deuda conocida a descomponer en
 * fases posteriores (2, 7), no un fallo de este test. Lo que este test SÍ
 * detecta es un monolito NUEVO: cualquier archivo fuera de esa lista que
 * supere el umbral es una señal de que algo creció sin decisión explícita —
 * en ese caso, o se descompone, o se agrega a la allowlist a propósito (y
 * ese commit debe justificar por qué).
 */

const DIALUX_ROOT = join(__dirname, '..');
const IGNORED_DIR_NAMES = new Set(['node_modules', '__architecture__']);

interface Allowlist {
    codeLimit: number;
    testLimit: number;
    allow: string[];
}

function loadAllowlist(): Allowlist {
    const raw = readFileSync(join(__dirname, 'fileSizeBudget.allowlist.json'), 'utf-8');
    return JSON.parse(raw) as Allowlist;
}

function countLines(filePath: string): number {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
}

function isTestOrFixture(relPath: string): boolean {
    return /\.test\.tsx?$/.test(relPath) || relPath.includes('__fixtures__') || relPath.includes('__benchmarks__');
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (IGNORED_DIR_NAMES.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (/\.tsx?$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

describe('Fase 0 — presupuesto de tamaño de archivos (§4.5 del plan maestro)', () => {
    const allowlist = loadAllowlist();
    const allowSet = new Set(allowlist.allow);

    it('la allowlist no referencia archivos inexistentes', () => {
        for (const relPath of allowlist.allow) {
            const full = join(DIALUX_ROOT, relPath);
            expect(() => statSync(full), `Falta el archivo listado en la allowlist: ${relPath}`).not.toThrow();
        }
    });

    it('ningún archivo NUEVO fuera de la allowlist supera el presupuesto de tamaño', () => {
        const files = walk(DIALUX_ROOT);
        const offenders: string[] = [];

        for (const full of files) {
            const relPath = relative(DIALUX_ROOT, full).split('\\').join('/');
            if (allowSet.has(relPath)) continue;

            const limit = isTestOrFixture(relPath) ? allowlist.testLimit : allowlist.codeLimit;
            const lines = countLines(full);

            if (lines > limit) {
                offenders.push(`${relPath}: ${lines} líneas (límite ${limit})`);
            }
        }

        expect(
            offenders,
            `Archivos nuevos que superan el presupuesto de tamaño sin estar en fileSizeBudget.allowlist.json:\n${offenders.join('\n')}\n\n` +
                'Descompón el archivo por responsabilidad, o si el tamaño está justificado ' +
                '(p. ej. datos estáticos), agrégalo a la allowlist explicando por qué en el mismo commit.',
        ).toEqual([]);
    });
});
