import { Upload } from 'lucide-react';
import { useState } from 'react';
import { extractErrorMessage, importPhotometryFile, type ImportedLuminaireProduct } from './catalogApi';

/**
 * Formulario de importación IES/LDT/GLDF, extraído de `components/CatalogPanel.tsx`
 * (Fase 2) sin cambiar comportamiento — mismo endpoint, misma validación, mismo JSX.
 */

interface ImportPhotometryFormProps {
    isLoadingProducts: boolean;
    onImported: (product: ImportedLuminaireProduct) => void;
}

export function ImportPhotometryForm({ isLoadingProducts, onImported }: ImportPhotometryFormProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [productName, setProductName] = useState('');
    const [manufacturerName, setManufacturerName] = useState('');
    const [productImage, setProductImage] = useState<File | null>(null);
    const [brandLogo, setBrandLogo] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [importWarnings, setImportWarnings] = useState<string[]>([]);

    const submitProductImport = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setImportError(null);
        setImportMessage(null);
        setImportWarnings([]);

        if (!selectedFile) {
            setImportError('Selecciona un archivo .ies, .ldt o .gldf.');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('normative_standard', 'universal');
        if (productName.trim()) formData.append('name', productName.trim());
        if (manufacturerName.trim()) formData.append('manufacturer', manufacturerName.trim());
        if (productImage) formData.append('product_image', productImage);
        if (brandLogo) formData.append('brand_logo', brandLogo);

        setIsUploading(true);

        try {
            const { product, message, warnings } = await importPhotometryFile(formData);
            onImported(product);
            setSelectedFile(null);
            setProductName('');
            setManufacturerName('');
            setProductImage(null);
            setBrandLogo(null);
            setImportMessage(message ?? 'Producto importado correctamente.');
            setImportWarnings(warnings ?? []);
        } catch (error) {
            setImportError(extractErrorMessage(error, 'No se pudo importar el producto.'));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form
            onSubmit={submitProductImport}
            className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-700 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-slate-200 sm:p-4 [&_input:not([type='checkbox'])]:h-9 [&_input:not([type='checkbox'])]:rounded-lg [&_input:not([type='checkbox'])]:border-slate-300 [&_input:not([type='checkbox'])]:bg-white [&_input:not([type='checkbox'])]:px-3 [&_input:not([type='checkbox'])]:text-xs [&_input:not([type='checkbox'])]:text-slate-900 dark:[&_input:not([type='checkbox'])]:border-slate-700 dark:[&_input:not([type='checkbox'])]:bg-slate-900 dark:[&_input:not([type='checkbox'])]:text-slate-100"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] text-amber-300/80">Importacion IES/LDT/GLDF</p>
                {isLoadingProducts && <span className="text-[8px] text-gray-500">Cargando...</span>}
            </div>
            <label className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-amber-700/30 bg-gray-950/30 px-2 py-1 text-[9px] text-amber-100 hover:bg-amber-900/20">
                <Upload size={9} />
                <span className="truncate">{selectedFile ? selectedFile.name : 'Seleccionar archivo .ies / .ldt / .gldf'}</span>
                <input
                    type="file"
                    accept=".ies,.ldt,.gldf,.txt,.xml"
                    className="hidden"
                    onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setImportError(null);
                        setImportMessage(null);
                    }}
                />
            </label>
            <div className="mt-1.5 grid grid-cols-1 gap-1">
                <input
                    type="text"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="Nombre del producto (opcional)"
                    className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                />
                <input
                    type="text"
                    value={manufacturerName}
                    onChange={(event) => setManufacturerName(event.target.value)}
                    placeholder="Marca / fabricante (opcional)"
                    className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
                <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[8px] text-gray-400 hover:border-amber-700/50 hover:text-amber-100">
                    <span className="truncate">{productImage ? productImage.name : 'Imagen producto'}</span>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => setProductImage(event.target.files?.[0] ?? null)}
                    />
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[8px] text-gray-400 hover:border-amber-700/50 hover:text-amber-100">
                    <span className="truncate">{brandLogo ? brandLogo.name : 'Logo marca'}</span>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => setBrandLogo(event.target.files?.[0] ?? null)}
                    />
                </label>
            </div>
            <button
                type="submit"
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-amber-700/70 py-1 text-[9px] text-amber-50 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedFile || isUploading}
            >
                <Upload size={9} />
                {isUploading ? 'Importando...' : 'Subir y registrar producto'}
            </button>
            {importError && <p className="mt-1 text-[8px] leading-tight text-red-300">{importError}</p>}
            {importMessage && <p className="mt-1 text-[8px] leading-tight text-emerald-300">{importMessage}</p>}
            {importWarnings.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                    {importWarnings.map((warning, index) => (
                        <li key={index} className="text-[8px] leading-tight text-amber-500">
                            ⚠ {warning}
                        </li>
                    ))}
                </ul>
            )}
        </form>
    );
}
