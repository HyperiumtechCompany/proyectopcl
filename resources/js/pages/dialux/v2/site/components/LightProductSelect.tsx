import { useLuminaireCatalog } from '../hooks/useLuminaireCatalog';

/**
 * Selector de producto del catálogo de luminarias COMPARTIDO con la V1 para
 * las luces de portones y techados. Con producto, el cálculo usa su
 * fotometría IES/LDT real; al elegirlo se copian su flujo y su potencia (se
 * pueden ajustar después). Sin producto = modelo lambertiano por flujo.
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
    return (
        <label className="col-span-2 grid gap-1 text-[11px] text-slate-500">
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
                        ...(product.totalLumens
                            ? { lumens: product.totalLumens }
                            : {}),
                        ...(product.powerWatts
                            ? { wattage: product.powerWatts }
                            : {}),
                    });
                }}
            >
                <option value="">
                    {catalog.loading
                        ? 'Cargando catálogo…'
                        : 'Genérica (sin fotometría)'}
                </option>
                {catalog.items.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                        {item.totalLumens ? ` · ${Math.round(item.totalLumens)} lm` : ''}
                        {item.powerWatts ? ` · ${item.powerWatts} W` : ''}
                    </option>
                ))}
            </select>
        </label>
    );
}
