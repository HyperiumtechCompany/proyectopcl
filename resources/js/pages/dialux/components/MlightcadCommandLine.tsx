import { Terminal, ChevronUp, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';

interface CommandEntry {
    id: number;
    text: string;
    type: 'input' | 'output' | 'error';
    ts: number;
}

let _cmdId = 0;

/**
 * MlightcadCommandLine — Barra de comandos estilo AutoCAD para el motor mlightcad.
 * Soporta todos los comandos registrados: zoom, pan, select, line, polyline, etc.
 */
export const MlightcadCommandLine: React.FC = () => {
    const engine = useMlightcadEngine();
    const [input, setInput]         = useState('');
    const [history, setHistory]     = useState<CommandEntry[]>([
        { id: 0, text: 'mlightcad CAD engine listo. Escribe un comando o importa un DXF/DWG.', type: 'output', ts: Date.now() }
    ]);
    const [histIdx, setHistIdx]     = useState(-1);
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [expanded, setExpanded]   = useState(true);

    const inputRef   = useRef<HTMLInputElement>(null);
    const scrollRef  = useRef<HTMLDivElement>(null);

    // Scroll al final cuando hay nuevas entradas
    useEffect(() => {
        if (scrollRef.current && expanded) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, expanded]);

    const log = useCallback((text: string, type: CommandEntry['type'] = 'output') => {
        setHistory(h => [...h.slice(-199), { id: ++_cmdId, text, type, ts: Date.now() }]);
    }, []);

    const executeCommand = useCallback((cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        log(`> ${trimmed}`, 'input');
        setCmdHistory(h => [trimmed, ...h.slice(0, 49)]);
        setHistIdx(-1);

        try {
            engine.sendCommand(trimmed);
            // Comandos especiales
            if (trimmed.toLowerCase() === 'zoom' || trimmed.toLowerCase() === 'z') {
                engine.fitToView();
                log('Vista ajustada al dibujo.', 'output');
            } else {
                log(`Comando ejecutado: ${trimmed}`, 'output');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`Error: ${msg}`, 'error');
        }
    }, [engine, log]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case 'Enter':
                executeCommand(input);
                setInput('');
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHistIdx(i => {
                    const nextIdx = Math.min(i + 1, cmdHistory.length - 1);
                    setInput(cmdHistory[nextIdx] ?? '');
                    return nextIdx;
                });
                break;
            case 'ArrowDown':
                e.preventDefault();
                setHistIdx(i => {
                    const nextIdx = Math.max(i - 1, -1);
                    setInput(nextIdx >= 0 ? cmdHistory[nextIdx] ?? '' : '');
                    return nextIdx;
                });
                break;
            case 'Escape':
                setInput('');
                setHistIdx(-1);
                break;
        }
    }, [input, cmdHistory, executeCommand]);

    // Comandos rápidos
    const quickCmds = ['zoom', 'pan', 'select', 'line', 'pline', 'circle', 'arc'];

    return (
        <div className="flex flex-col bg-gray-50 dark:bg-[#0a0c10] border-t border-slate-300 dark:border-slate-800/80 shrink-0 select-none"
             style={{ height: expanded ? '140px' : '32px', transition: 'height 0.2s ease' }}>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center h-8 px-2 border-b border-slate-300 dark:border-slate-800/60 shrink-0 gap-2">
                <Terminal size={11} className="text-cyan-600" />
                <span className="text-[10px] text-cyan-700 font-mono font-semibold tracking-widest uppercase">
                    Command
                </span>

                {/* Quick commands */}
                {expanded && (
                    <div className="flex gap-1 ml-2 overflow-x-auto scrollbar-none flex-1">
                        {quickCmds.map(cmd => (
                            <button key={cmd}
                                onClick={() => executeCommand(cmd)}
                                className="px-2 py-0.5 text-[9px] font-mono rounded bg-slate-200 dark:bg-slate-800/60 text-slate-500 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors border border-slate-300 dark:border-slate-700/40 shrink-0">
                                {cmd.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1" />

                <button
                    onClick={() => setExpanded(e => !e)}
                    className="text-slate-600 hover:text-slate-700 dark:text-slate-300 transition-colors p-0.5 rounded"
                    title={expanded ? 'Colapsar consola' : 'Expandir consola'}
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
            </div>

            {/* ── Log de comandos ──────────────────────────────────────────── */}
            {expanded && (
                <>
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800"
                    >
                        {history.map(entry => (
                            <div key={entry.id} className={`text-[10px] font-mono leading-4 ${
                                entry.type === 'input'  ? 'text-cyan-300' :
                                entry.type === 'error'  ? 'text-red-400'  :
                                                          'text-slate-500'
                            }`}>
                                {entry.text}
                            </div>
                        ))}
                    </div>

                    {/* ── Input ──────────────────────────────────────────────── */}
                    <div className="flex items-center border-t border-slate-300 dark:border-slate-800/60 px-2 h-8 shrink-0 gap-2">
                        <span className="text-cyan-600 font-mono text-[11px] shrink-0">Command:</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un comando (ZOOM, PAN, LINE…)"
                            className="flex-1 bg-transparent text-[11px] font-mono text-cyan-100 placeholder-slate-700 outline-none caret-cyan-400"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                </>
            )}
        </div>
    );
};
