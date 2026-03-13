/**
 * Luckysheet.tsx — Wrapper React para hoja de cálculo con auto-cálculos
 */

import React, { useEffect, useRef, useState } from 'react';

type ScriptState = 'idle' | 'loading' | 'ready' | 'error';
let _scriptState: ScriptState = 'idle';
const _callbacks: Array<(state: 'ready' | 'error') => void> = [];

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.async = false;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
        document.head.appendChild(s);
    });
}

function loadLuckysheetScript(onDone: (state: 'ready' | 'error') => void): void {
    if (_scriptState === 'ready') { onDone('ready'); return; }
    if (_scriptState === 'error') { onDone('error'); return; }
    _callbacks.push(onDone);
    if (_scriptState === 'loading') return;
    _scriptState = 'loading';

    loadScript('/luckysheet/jquery.mousewheel.js')
        .then(() => loadScript('/luckysheet/plugins/js/plugin.js'))
        .then(() => loadScript('/luckysheet/luckysheet.umd.js'))
        .then(() => { _scriptState = 'ready'; _callbacks.forEach(cb => cb('ready')); _callbacks.length = 0; })
        .catch((err) => {
            _scriptState = 'error';
            _callbacks.forEach(cb => cb('error')); _callbacks.length = 0;
            console.error('[Luckysheet] Error cargando scripts:', err);
        });
}

interface LuckysheetProps {
    data?: any[];
    options?: Record<string, any>;
    onDataChange?: (sheets: any[]) => void;
    onReady?: (ls: any) => void;  // ✅ NUEVO: callback cuando Luckysheet está listo
    height?: string;
    canEdit?: boolean;
}

const Luckysheet: React.FC<LuckysheetProps> = ({
    data, options = {}, onDataChange, onReady, height = '600px', canEdit = true
}) => {
    const containerIdRef = useRef<string>('ls-' + Math.random().toString(36).slice(2, 8));
    const containerId = containerIdRef.current;
    const [scriptState, setScriptState] = useState<ScriptState>(_scriptState);
    const isInitialized = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cargar scripts y CSS
    useEffect(() => {
        const win = window as any;
        win.__luckysheet_css_ref_count = (win.__luckysheet_css_ref_count || 0) + 1;

        const cssLinks = [
            { id: 'luckysheet-css-plugins', href: '/luckysheet/plugins/css/pluginsCss.css' },
            { id: 'luckysheet-css-plugins-base', href: '/luckysheet/plugins/plugins.css' },
            { id: 'luckysheet-css-core', href: '/luckysheet/css/luckysheet.css' },
            { id: 'luckysheet-css-iconfont', href: '/luckysheet/assets/iconfont/iconfont.css' },
        ];
        cssLinks.forEach(({ id, href }) => {
            let link = document.getElementById(id) as HTMLLinkElement;
            if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link); }
        });

        let isCanceled = false;
        if (_scriptState === 'ready') { setScriptState('ready'); }
        else { loadLuckysheetScript((state) => { if (!isCanceled) setScriptState(state); }); }

        return () => {
            isCanceled = true;
            win.__luckysheet_css_ref_count -= 1;
            if (win.__luckysheet_css_ref_count <= 0) {
                win.__luckysheet_css_ref_count = 0;
                cssLinks.forEach(({ id }) => { const link = document.getElementById(id); if (link) link.remove(); });
            }
        };
    }, []);

    // Inicializar Luckysheet
    useEffect(() => {
        if (scriptState !== 'ready' || isInitialized.current) return;
        isInitialized.current = true;

        const initialData = Array.isArray(data) && data.length > 0 ? data : [{ name: 'Metrado', status: 1, order: 0, row: 40, column: 18, celldata: [], config: {} }];

        timerRef.current = setTimeout(() => {
            const ls = (window as any).luckysheet;
            if (!ls) { console.error('[Luckysheet] window.luckysheet no disponible'); return; }

            const captureSheetsData = () => {
                setTimeout(() => {
                    try { const sheets = ls.getAllSheets(); if (onDataChange && Array.isArray(sheets)) onDataChange(sheets); }
                    catch (e) { console.warn('[Luckysheet] getAllSheets falló:', e); }
                }, 0);
            };

            try {
                ls.create({
                    container: containerId, data: initialData, lang: 'es', showinfobar: false,
                    showstatisticBar: true, sheetFormulaBar: false, column: 18, // ✅ Máximo 18 columnas (A-R)
                    ...options,
                    afterChange: (r: number, c: number, v: any) => {
                        captureSheetsData();
                        options?.afterChange?.(r, c, v);
                    },
                    updated: (operate: any) => { captureSheetsData(); options?.updated?.(operate); },
                });
                // ✅ Notificar que Luckysheet está listo
                if (onReady) onReady(ls);
            } catch (err) { console.error('[Luckysheet] Error en create():', err); }
        }, 300);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); isInitialized.current = false; };
    }, [scriptState]);

    if (scriptState === 'error') {
        return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="rounded border border-red-300 bg-red-50 text-sm text-red-600">
            <div className="text-center p-4"><p className="font-semibold">Error al cargar Luckysheet</p>
            <p className="mt-1 text-xs text-red-500">Verifica: public/luckysheet/luckysheet.umd.js</p></div></div>;
    }
    if (scriptState !== 'ready') {
        return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="rounded border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-400"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" /> Cargando…</div></div>;
    }

    return <div id={containerId} style={{ width: '100%', height, position: 'relative', overflow: 'hidden', background: '#fff' }} />;
};

export default Luckysheet;