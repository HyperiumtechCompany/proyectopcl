import { ImagePlus, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLuminaireCatalog } from '../hooks/useLuminaireCatalog';
import { importLuminaireFile } from '../lib/luminaireCatalog';

/**
 * Selector de producto del catálogo de luminarias COMPARTIDO con la V1 (postes
 * proyectados, portones, techados, balizas). Con producto, el cálculo usa su
 * fotometría IES/LDT real; al elegirlo se copian su flujo y su potencia (se
 * pueden ajustar después). Sin producto = modelo lambertiano por flujo.
 * "Importar LDT / IES" (con foto opcional) lo sube al mismo catálogo y lo
 * deja elegido.
 */
export function LightProductSelect({
    productId,
    onChange,
}: {
    productId: number | undefined;
    onChange: (patch: {
        productId: number | undefined;
        lumens?: number;
        wattage?: number;
    }) => void;
}) {
    const catalog = useLuminaireCatalog();
    const fileRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        setMessage(null);
        try {
            const { item } = await importLuminaireFile(file, image ?? undefined);
            catalog.reload();
            setImage(null);
            onChange({
                productId: item.id,
                ...(item.totalLumens ? { lumens: item.totalLumens } : {}),
                ...(item.powerWatts ? { wattage: item.powerWatts } : {}),
            });
            setMessage(`Importada "${item.name}" (también disponible en la V1).`);
        } catch (error) {
            setMessage(`No se pudo importar: ${error instanceof Error ? error.message : 'error'}`);
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="col-span-2 grid gap-1">
            <label className="grid gap-1 text-[11px] text-slate-500">
                Luminaria del catálogo (fotometría IES/LDT)
                <select
                    className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                    value={productId ?? ''}
                    onChange={(event) => {
                        const id = Number(event.target.value);
                        const product = catalog.items.find((item) => item.id === id);
                        if (!product) {
                            onChange({ productId: undefined });
                            return;
                        }
                        onChange({
                            productId: product.id,
                            ...(product.totalLumens ? { lumens: product.totalLumens } : {}),
                            ...(product.powerWatts ? { wattage: product.powerWatts } : {}),
                        });
                    }}
                >
                    <option value="">{catalog.loading ? 'Cargando catálogo…' : 'Genérica (sin fotometría)'}</option>
                    {catalog.items.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                            {item.totalLumens ? ` · ${Math.round(item.totalLumens)} lm` : ''}
                            {item.powerWatts ? ` · ${item.powerWatts} W` : ''}
                        </option>
                    ))}
                </select>
            </label>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    <Upload className="h-3 w-3" />
                    {busy ? 'Importando…' : 'Importar LDT / IES'}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => imageRef.current?.click()}
                    title="Foto del producto que se guarda con el LDT/IES al importarlo"
                    className="flex min-w-0 items-center gap-1 rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-white/5"
                >
                    <ImagePlus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{image ? image.name : 'Foto (opcional)'}</span>
                </button>
                <input ref={fileRef} type="file" accept=".ldt,.ies,.gldf,.txt,.xml" className="hidden" onChange={(event) => void onFile(event.target.files?.[0])} />
                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </div>
            {message && <p className="text-[10px] text-slate-500">{message}</p>}
        </div>
    );
}
