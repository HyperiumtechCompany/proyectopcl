import { GitBranch, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface AutoMapToolbarProps {
    title: string;
    subtitle: string;
    scale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
}

export function AutoMapToolbar({ title, subtitle, scale, onZoomIn, onZoomOut, onReset }: AutoMapToolbarProps) {
    return (
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#101218] px-4">
            <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
                    <GitBranch size={15} className="text-white" />
                </div>
                <div>
                    <p className="text-sm font-semibold tracking-tight text-zinc-100">{title}</p>
                    <p className="text-[11px] text-zinc-500">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <button onClick={onZoomOut} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100" aria-label="Alejar">
                    <ZoomOut size={16} />
                </button>
                <span className="w-10 text-center text-xs tabular-nums text-zinc-500">{Math.round(scale * 100)}%</span>
                <button onClick={onZoomIn} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100" aria-label="Acercar">
                    <ZoomIn size={16} />
                </button>
                <button onClick={onReset} className="ml-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100" aria-label="Centrar vista">
                    <Maximize2 size={16} />
                </button>
            </div>
        </div>
    );
}
