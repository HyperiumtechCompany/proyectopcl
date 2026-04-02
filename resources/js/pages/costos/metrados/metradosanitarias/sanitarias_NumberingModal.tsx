// ═══════════════════════════════════════════════════
// sanitarias_NumberingModal.tsx — Numeración jerárquica
// ═══════════════════════════════════════════════════

import { Hash }   from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { LEAF_STYLE, LEVEL_PALETTE, MAX_LEVELS } from './sanitarias_constants';
import { ALL_COLS, CI } from './sanitarias_constants';
import type { RowKind } from './sanitarias_types';
import { mkTxt, pad2, r4, readRow, rowMeta, toNum, trim0 } from './sanitarias_utils';
import { levelStyle } from './sanitarias_utils';

export interface NumberingModalProps {
  open:    boolean;
  onClose: () => void;
  onApply: (base: number) => void;
}

const hasDescription = (desc: string): boolean =>
  desc.trim() !== '' && desc.trim() !== '0';

export function NumberingModal({ open, onClose, onApply }: NumberingModalProps) {
  const [baseStr, setBaseStr] = useState('4');
  const base = Math.max(1, Math.min(99, toNum(baseStr) || 1));

  const preview = useMemo(() => {
    const items: { code: string; lvl: number; isLeaf: boolean }[] = [];
    const counters = new Array(MAX_LEVELS + 1).fill(0);
    counters[1] = base - 1;

    const MOCK: { level: number; kind: RowKind }[] = [
      { level: 1, kind: 'group' },
      { level: 2, kind: 'group' },
      { level: 3, kind: 'group' },
      { level: 4, kind: 'leaf'  },
    ];

    MOCK.forEach(({ level, kind }) => {
      for (let i = level + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
      counters[level]++;
      const code = counters.slice(1, level + 1).map(pad2).join('.');
      items.push({ code, lvl: level, isLeaf: kind === 'leaf' });
    });

    return items;
  }, [base]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="z-9999 max-w-sm gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
        style={{ zIndex: 9999 }}>
        <DialogHeader className="border-b border-slate-100 bg-linear-to-r
          from-violet-600 to-violet-700 px-5 py-4 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-bold text-white">
            <Hash className="h-4.5 w-4.5" />
            Numeración Jerárquica
          </DialogTitle>
          <DialogDescription className="text-[11px] text-violet-200">
            Asigna códigos jerárquicos a ítems del metrado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 bg-white px-5 py-4 dark:bg-slate-900">
          <div>
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Capítulo base (número de inicio)
            </Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={baseStr}
              onChange={(e) => setBaseStr(e.target.value)}
              className="mt-1.5 h-12 text-center text-[24px] font-bold tracking-widest"
            />
            <p className="mt-1.5 text-center font-mono text-[11px] text-slate-400">
              → primer ítem de nivel 1:{' '}
              <code className="rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                {pad2(base)}
              </code>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3
            dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Vista previa de jerarquía
            </p>
            <div className="space-y-1.5">
              {preview.map(({ code, lvl, isLeaf }) => {
                const st = isLeaf ? LEAF_STYLE : LEVEL_PALETTE[lvl - 1];
                return (
                  <div key={code} className="flex items-center gap-2.5">
                    <code
                      className="w-[150px] rounded px-2 py-1 text-center font-mono text-[10px] font-bold"
                      style={{ background: st.bg, color: st.fc, border: isLeaf ? '1px solid #e2e8f0' : 'none' }}
                    >
                      {code}
                    </code>
                    <span className="text-[10px] text-slate-400">
                      {isLeaf ? 'Hoja / Partida' : `Grupo nivel ${lvl}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200
            bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-950/20">
            <span className="mt-0.5 text-[12px]">⚠</span>
            <div className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
              <strong>Se numeran solo las filas con descripción real.</strong>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-5 py-3
          dark:border-slate-800 dark:bg-slate-900">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => { onApply(base); onClose(); }} className="bg-violet-600 hover:bg-violet-700">
            <Hash className="mr-1.5 h-3.5 w-3.5" />
            Aplicar numeración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function buildNumberingUpdates(
  data:       any[][],
  sheetOrder: number,
  base:       number,
): Array<{ r: number; c: number; v: any }> {
  const rows: Array<{ ri: number; level: number; kind: RowKind }> = [];

  for (let r = 1; r < data.length; r++) {
    const row  = readRow(data, r);
    const desc = trim0(row.descripcion);
    if (!hasDescription(desc)) continue;
    const { level, kind } = rowMeta(row);
    rows.push({ ri: r, level, kind });
  }

  if (!rows.length) return [];

  const counters = new Array(MAX_LEVELS + 1).fill(0);
  counters[1]    = base - 1; 

  const updates: Array<{ r: number; c: number; v: any }> = [];

  rows.forEach(({ ri, level, kind }) => {
    for (let i = level + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
    counters[level]++;
    const code = counters.slice(1, level + 1).map(pad2).join('.');
    const st   = kind === 'group' ? levelStyle(level) : LEAF_STYLE;

    updates.push({
      r:  ri,
      c:  CI['partida'],
      v: {
        v:  code,
        m:  code,
        ct: { fa: '@', t: 'g' },
        bl: st.bl,
        fs: 10,
        bg: st.bg,
        fc: st.fc,
      },
    });
  });

  return updates;
}
