import { Archive, FileText, Flag, Pencil, Plus, Trash2, X } from 'lucide-react';
import { avanceTier, COLORS, STATUS_DOT, TYPE_ICON } from './types';
import type { TreeNode } from './types';

interface NodeDetailPanelProps {
    selected: TreeNode;
    isProtected: boolean;
    selectedChildrenLabel: string;
    depth: number;
    cantidadModulos: number | null;
    onClose: () => void;
    onSelectChild: (child: TreeNode) => void;
    onRequestAddChild: () => void;
    onRequestEdit: () => void;
    onRequestDelete: () => void;
}

/** Nivel "verde": hijo directo del nodo disciplina (morado), que a su vez es hijo directo de la cabeza. */
const GREEN_LEVEL_DEPTH = 2;

export function NodeDetailPanel({ selected, isProtected, selectedChildrenLabel, depth, cantidadModulos, onClose, onSelectChild, onRequestAddChild, onRequestEdit, onRequestDelete }: NodeDetailPanelProps) {
    const color = COLORS[selected.color] || COLORS.violet;
    const isHead = selected.role === 'head';
    const isTail = selected.role === 'tail';
    const Icon = isHead ? Flag : isTail ? Archive : TYPE_ICON[selected.type] || FileText;
    const isCircle = selected.shape === 'circle';
    const roleSubtitle = isHead ? 'Cabeza del proyecto' : isTail ? 'Cola · nodo de cierre' : null;
    const tier = avanceTier(selected.avance);
    const isGreenLevel = depth === GREEN_LEVEL_DEPTH;
    const diasPorModulo = isGreenLevel && cantidadModulos ? selected.diasTotal / cantidadModulos : null;

    return (
        <div className={`absolute right-0 top-0 h-full w-80 overflow-y-auto border-l bg-[#101218] p-4 shadow-2xl ${isProtected ? color.border : 'border-white/10'}`}>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center ${isCircle ? 'rounded-full' : 'rounded-sm'} ${color.bg}/20`}>
                        <Icon size={14} className={color.text} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-zinc-100">{selected.title}</h2>
                        {roleSubtitle && <p className={`text-[10px] font-semibold uppercase tracking-wide ${color.text}`}>{roleSubtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onRequestEdit} className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100" aria-label="Editar nodo" title="Editar nodo">
                        <Pencil size={15} />
                    </button>
                    <button
                        onClick={onRequestDelete}
                        disabled={isProtected}
                        className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                        aria-label="Eliminar nodo"
                        title={isProtected ? 'Este nodo es estructural (cabeza/cola) y no se puede eliminar' : 'Eliminar nodo'}>
                        <Trash2 size={15} />
                    </button>
                    <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-white/10" aria-label="Cerrar panel">
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="mb-3 -mt-1 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[selected.status] || 'bg-zinc-600'}`} />
                <span className="text-xs text-zinc-400">{selected.status || 'Sin estado'}</span>
            </div>

            <div className={`mb-4 grid grid-cols-3 gap-1.5 rounded-lg border p-2 text-center ${tier.border} ${tier.bg}`}>
                <div>
                    <p className={`text-sm font-semibold ${tier.text}`}>{selected.avance.toFixed(0)}%</p>
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500">Avance</p>
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-200">{selected.pesoTotal.toFixed(2)}</p>
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500">Peso</p>
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-200">{selected.diasTotal.toFixed(2)}</p>
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500">Dias</p>
                </div>
            </div>

            {isGreenLevel && (
                <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                    <p className="text-sm font-semibold text-zinc-100">{diasPorModulo !== null ? diasPorModulo.toFixed(2) : '—'}</p>
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500">
                        Dias / modulo{cantidadModulos ? ` (${selected.diasTotal.toFixed(2)} ÷ ${cantidadModulos})` : ' — falta cantidad de modulos del proyecto'}
                    </p>
                </div>
            )}

            {selected.type === 'text' && <p className="text-sm leading-relaxed text-zinc-400">{typeof selected.content === 'string' ? selected.content : ''}</p>}

            {selected.type === 'table' && (
                <div className="overflow-hidden rounded-lg border border-white/10">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-white/5">
                                {selected.content && typeof selected.content !== 'string' && 'headers' in selected.content
                                    ? selected.content.headers.map((header, index) => (
                                          <th key={index} className="px-2.5 py-2 text-left font-medium text-zinc-300">
                                              {header}
                                          </th>
                                      ))
                                    : null}
                            </tr>
                        </thead>
                        <tbody>
                            {selected.content && typeof selected.content !== 'string' && 'rows' in selected.content
                                ? selected.content.rows.map((row, index) => (
                                      <tr key={index} className="border-t border-white/5">
                                          {row.map((cell, cellIndex) => (
                                              <td key={`${index}-${cellIndex}`} className="px-2.5 py-2 text-zinc-400">
                                                  {cell}
                                              </td>
                                          ))}
                                      </tr>
                                  ))
                                : null}
                        </tbody>
                    </table>
                </div>
            )}

            {selected.type === 'image' && (
                <div>
                    {typeof selected.content !== 'string' && 'url' in selected.content && (
                        <>
                            <img src={selected.content.url} alt={selected.content.caption} className="w-full rounded-lg border border-white/10" />
                            <p className="mt-2 text-xs text-zinc-500">{selected.content.caption}</p>
                        </>
                    )}
                </div>
            )}

            {selected.type === 'video' && (
                <div>
                    {typeof selected.content !== 'string' && 'url' in selected.content && (
                        <>
                            <video src={selected.content.url} controls className="w-full rounded-lg border border-white/10" />
                            <p className="mt-2 text-xs text-zinc-500">{selected.content.caption}</p>
                        </>
                    )}
                </div>
            )}

            {selected.children.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">
                        {selectedChildrenLabel} ({selected.children.length})
                    </p>
                    <div className="flex flex-col gap-1.5">
                        {selected.children.map((child) => (
                            <button key={child.id} onClick={() => onSelectChild(child)} className="rounded-md bg-white/5 px-2.5 py-1.5 text-left text-xs text-zinc-300 transition-colors hover:bg-white/10 hover:text-white">
                                {child.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {selected.role !== 'tail' && (
                <button
                    onClick={onRequestAddChild}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 text-xs text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100">
                    <Plus size={13} /> Anadir nodo hijo
                </button>
            )}
        </div>
    );
}
