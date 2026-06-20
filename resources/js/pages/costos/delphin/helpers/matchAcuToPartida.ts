import type { DelphinRow } from '../types';
import type { ParsedAcu } from './parseAcuExcel';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchMethod = 'code' | 'name' | 'none';

export interface AcuMatch {
    acu:    ParsedAcu;
    row:    DelphinRow | null;
    method: MatchMethod;
}

// ─── Text normalization ───────────────────────────────────────────────────────

function normalize(s: string): string {
    return s
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')  // strip accents
        .replace(/[^A-Z0-9\s]/g, ' ')     // keep only alphanumeric
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export function matchAcuToPartida(acus: ParsedAcu[], rows: DelphinRow[]): AcuMatch[] {
    // Index 1: exact partida code  (e.g. "1.1.1.1")
    const byCode = new Map<string, DelphinRow>();
    // Index 2: normalized description
    const byName = new Map<string, DelphinRow>();

    for (const row of rows) {
        if (row.partida)     byCode.set(row.partida.trim(), row);
        if (row.descripcion) {
            const key = normalize(row.descripcion);
            if (key) byName.set(key, row);
        }
    }

    return acus.map((acu): AcuMatch => {
        // ── Filter 1 (CELESTE): exact code ───────────────────────────────────
        if (acu.partida_code) {
            const hit = byCode.get(acu.partida_code.trim());
            if (hit) return { acu, row: hit, method: 'code' };
        }

        // ── Filter 2 (NARANJA): normalized description ────────────────────────
        if (acu.partida_desc) {
            const key = normalize(acu.partida_desc);
            if (key) {
                const hit = byName.get(key);
                if (hit) return { acu, row: hit, method: 'name' };
            }
        }

        return { acu, row: null, method: 'none' };
    });
}

// ─── Summary helper ───────────────────────────────────────────────────────────

export interface MatchSummary {
    byCode:   number;
    byName:   number;
    unmatched: number;
}

export function summarizeMatches(matches: AcuMatch[]): MatchSummary {
    return matches.reduce<MatchSummary>(
        (acc, m) => {
            if (m.method === 'code')   acc.byCode++;
            else if (m.method === 'name') acc.byName++;
            else                         acc.unmatched++;
            return acc;
        },
        { byCode: 0, byName: 0, unmatched: 0 },
    );
}
