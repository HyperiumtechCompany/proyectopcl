import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';

/** Botón que abre el selector de archivo Excel y entrega su contenido. */
export function ExcelFileButton({ label = 'Importar Excel', onFile }: { label?: string; onFile: (data: ArrayBuffer, fileName: string) => Promise<void> }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    const handle = async (file: File) => {
        setLoading(true);
        try {
            await onFile(await file.arrayBuffer(), file.name);
        } finally {
            setLoading(false);
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                        void handle(file);
                    }
                }}
            />
            <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs print:hidden font-semibold text-stone-700 hover:border-orange-400 hover:text-orange-700 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
            >
                <FileUp className="size-3.5" /> {loading ? 'Leyendo…' : label}
            </button>
        </>
    );
}
