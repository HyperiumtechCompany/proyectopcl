import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { NodoFormValues } from '@/pages/gestor-proyectos/hooks/useGestorProyectoNodos';
import { NODE_COLORS, NODE_SHAPES, NODE_STATUSES, NODE_TYPES } from './types';

interface NodeFormDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialValues?: NodoFormValues;
    isSaving: boolean;
    onClose: () => void;
    onSubmit: (values: NodoFormValues) => Promise<void> | void;
}

const DEFAULT_VALUES: NodoFormValues = {
    title: '',
    type: 'text',
    shape: 'square',
    color: 'violet',
    status: 'Pendiente',
    content: { text: '' },
    peso: null,
    dias: null,
};

const inputClassName = 'w-full rounded-md border border-white/10 bg-[#1a1d27] px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/30';
const labelClassName = 'mb-1 block text-[11px] uppercase tracking-wide text-zinc-500';

export function NodeFormDialog({ open, mode, initialValues, isSaving, onClose, onSubmit }: NodeFormDialogProps) {
    const [title, setTitle] = useState(DEFAULT_VALUES.title);
    const [type, setType] = useState(DEFAULT_VALUES.type);
    const [shape, setShape] = useState(DEFAULT_VALUES.shape);
    const [color, setColor] = useState(DEFAULT_VALUES.color);
    const [status, setStatus] = useState(DEFAULT_VALUES.status);
    const [text, setText] = useState('');
    const [headersInput, setHeadersInput] = useState('');
    const [rowsInput, setRowsInput] = useState('');
    const [url, setUrl] = useState('');
    const [caption, setCaption] = useState('');
    const [peso, setPeso] = useState('');
    const [dias, setDias] = useState('');

    useEffect(() => {
        if (!open) {
            return;
        }

        const values = initialValues ?? DEFAULT_VALUES;
        setTitle(values.title);
        setType(values.type);
        setShape(values.shape);
        setColor(values.color);
        setStatus(values.status);
        setText(values.content.text ?? '');
        setHeadersInput((values.content.headers ?? []).join(', '));
        setRowsInput((values.content.rows ?? []).map((row) => row.join(', ')).join('\n'));
        setUrl(values.content.url ?? '');
        setCaption(values.content.caption ?? '');
        setPeso(values.peso === null || values.peso === undefined ? '' : String(values.peso));
        setDias(values.dias === null || values.dias === undefined ? '' : String(values.dias));
    }, [open, initialValues]);

    const handleSubmit = async () => {
        if (!title.trim()) {
            return;
        }

        const content =
            type === 'text'
                ? { text }
                : type === 'table'
                  ? {
                        headers: headersInput.split(',').map((h) => h.trim()).filter(Boolean),
                        rows: rowsInput
                            .split('\n')
                            .map((line) => line.split(',').map((cell) => cell.trim()))
                            .filter((row) => row.some((cell) => cell !== '')),
                    }
                  : { url, caption };

        const parsedPeso = peso.trim() === '' ? null : Number(peso);
        const parsedDias = dias.trim() === '' ? null : Number(dias);

        await onSubmit({
            title: title.trim(),
            type,
            shape,
            color,
            status,
            content,
            peso: parsedPeso !== null && Number.isNaN(parsedPeso) ? null : parsedPeso,
            dias: parsedDias !== null && Number.isNaN(parsedDias) ? null : parsedDias,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#101218] text-zinc-100 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100">{mode === 'create' ? 'Anadir nodo' : 'Editar nodo'}</DialogTitle>
                    <DialogDescription className="text-zinc-500">Completa los campos del nodo y guarda para actualizar el mapa del proyecto.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    <div>
                        <label className={labelClassName}>Titulo</label>
                        <input className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo del nodo" autoFocus />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClassName}>Tipo</label>
                            <select className={inputClassName} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                                {NODE_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClassName}>Forma</label>
                            <select className={inputClassName} value={shape} onChange={(e) => setShape(e.target.value as typeof shape)}>
                                {NODE_SHAPES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClassName}>Color</label>
                            <select className={inputClassName} value={color} onChange={(e) => setColor(e.target.value as typeof color)}>
                                {NODE_COLORS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClassName}>Estado</label>
                            <select className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                                {NODE_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClassName}>Peso (solo si no tiene hijos)</label>
                            <input type="number" min="0" step="any" className={inputClassName} value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0.00" />
                        </div>
                        <div>
                            <label className={labelClassName}>Dias (solo si no tiene hijos)</label>
                            <input type="number" min="0" step="any" className={inputClassName} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="0.00" />
                        </div>
                    </div>

                    {type === 'text' && (
                        <div>
                            <label className={labelClassName}>Contenido</label>
                            <textarea className={`${inputClassName} min-h-24 resize-y`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Descripcion del nodo" />
                        </div>
                    )}

                    {type === 'table' && (
                        <>
                            <div>
                                <label className={labelClassName}>Encabezados (separados por coma)</label>
                                <input className={inputClassName} value={headersInput} onChange={(e) => setHeadersInput(e.target.value)} placeholder="Columna 1, Columna 2" />
                            </div>
                            <div>
                                <label className={labelClassName}>Filas (una por linea, celdas separadas por coma)</label>
                                <textarea className={`${inputClassName} min-h-24 resize-y font-mono text-xs`} value={rowsInput} onChange={(e) => setRowsInput(e.target.value)} placeholder={'Valor A, Valor B\nValor C, Valor D'} />
                            </div>
                        </>
                    )}

                    {(type === 'image' || type === 'video') && (
                        <>
                            <div>
                                <label className={labelClassName}>URL</label>
                                <input className={inputClassName} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                            </div>
                            <div>
                                <label className={labelClassName}>Descripcion</label>
                                <input className={inputClassName} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Pie de foto o video" />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving || !title.trim()}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                        {isSaving ? 'Guardando...' : mode === 'create' ? 'Anadir' : 'Guardar'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
