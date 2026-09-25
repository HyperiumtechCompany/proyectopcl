import { Download, FileDown, Printer, X } from 'lucide-react';
import { downloadDxfDocument } from '@/pages/dialux/export/downloadDxfDocument';
import type { SingleLineDiagram } from '../domain/singleLineDiagram';
import { renderSingleLineDxf, renderSingleLineSvg } from '../domain/singleLineRender';

const safeName = (name: string) => (name || 'red').replace(/[^a-zA-Z0-9_-]/g, '_');

function downloadText(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Unifilar de la red (E2): vista previa y exportación a DXF (AutoCAD), SVG e
 * impresión a PDF (diálogo de impresión del navegador, "Guardar como PDF").
 * Se genera en el momento desde los mismos datos de Red y CT.
 */
export function SingleLineDiagramDialog({
    diagram,
    projectName,
    onClose,
}: {
    diagram: SingleLineDiagram;
    projectName: string;
    onClose: () => void;
}) {
    const svg = renderSingleLineSvg(diagram);
    const base = `${safeName(projectName)}_unifilar`;

    const print = () => {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(
            `<!doctype html><html><head><title>${base}</title><style>@page{size:${diagram.widthMm}mm ${diagram.heightMm}mm;margin:0}body{margin:0}</style></head><body>${svg}</body></html>`,
        );
        win.document.close();
        win.focus();
        win.print();
    };

    const button =
        'inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-2xl dark:bg-[#101218]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
                    <h2 className="mr-auto text-sm font-bold text-slate-900 dark:text-white">
                        Diagrama unifilar
                    </h2>
                    <button
                        type="button"
                        className={button}
                        onClick={() => downloadDxfDocument(renderSingleLineDxf(diagram), `${base}.dxf`)}
                    >
                        <FileDown className="h-4 w-4" />
                        DXF (AutoCAD)
                    </button>
                    <button
                        type="button"
                        className={button}
                        onClick={() => downloadText(svg, `${base}.svg`, 'image/svg+xml;charset=utf-8')}
                    >
                        <Download className="h-4 w-4" />
                        SVG
                    </button>
                    <button type="button" className={button} onClick={print}>
                        <Printer className="h-4 w-4" />
                        Imprimir / PDF
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        title="Cerrar"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 dark:bg-black/30">
                    {/* SVG generado aquí mismo con textos escapados (`renderSingleLineSvg`). */}
                    <div
                        className="mx-auto w-fit shadow"
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                </div>
                <p className="border-t border-slate-200 px-4 py-2 text-[10px] text-slate-500 dark:border-white/10">
                    {diagram.nodes.length} equipos · {diagram.edges.length} tramos · papel{' '}
                    {Math.round(diagram.widthMm)} × {Math.round(diagram.heightMm)} mm. En rojo:
                    fuera del límite configurado o falla de cortocircuito. Se regenera con cada
                    cambio de la red.
                </p>
            </div>
        </div>
    );
}
