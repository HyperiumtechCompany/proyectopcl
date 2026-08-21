import { Upload } from 'lucide-react';
import { useState } from 'react';
import {
    extractErrorMessage,
    importPhotometryFile,
    previewPhotometryFile,
    type ImportedLuminaireProduct,
    type PreviewedLuminaireProduct,
} from './catalogApi';
import { PhotometricPreviewModal, type PhotometricPreviewOverrides } from './PhotometricPreviewModal';

/**
 * Formulario de importación IES/LDT/GLDF, extraído de `components/CatalogPanel.tsx`
 * (Fase 2) sin cambiar comportamiento — mismo endpoint, misma validación, mismo JSX.
 *
 * Ronda 21 (`planes/plan_ldt_ies_lector_editor.md`): el submit YA NO guarda
 * directo — primero llama `previewPhotometryFile` (parsea sin persistir) y
 * abre `PhotometricPreviewModal` con todo lo que el parser extrajo (marca,
 * forma, dimensiones, CDL polar, tabla UGR); el guardado real solo ocurre
 * cuando el usuario confirma desde el modal, con los campos que haya editado.
 *
 * Ronda 21f: este formulario de subida quedó reducido a SOLO seleccionar el
 * archivo — nombre, marca, imagen de producto y logo de marca se piden y
 * editan dentro de `PhotometricPreviewModal` (antes vivían acá, duplicados
 * con los mismos campos del modal, y el usuario reportó que las imágenes no
 * se guardaban al crear por esa duplicación de estado). Es el modal el que
 * envía todo al confirmar — un solo lugar donde se captura la ficha completa.
 */

interface ImportPhotometryFormProps {
    isLoadingProducts: boolean;
    onImported: (product: ImportedLuminaireProduct) => void;
    /** Precarga nombre/marca al "subir" una luminaria del catálogo estático (`fixtureCatalog`) a un producto real con LDT/IES (Ronda 21e, request C). */
    initialName?: string;
    initialManufacturer?: string;
}

export function ImportPhotometryForm({ isLoadingProducts, onImported, initialName = '', initialManufacturer = '' }: ImportPhotometryFormProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    // Solo alimentan la llamada de previsualización (para que, al "subir un
    // archivo real" desde un ítem del catálogo estático, el modal abra ya
    // con ese nombre/marca) — no hay campos visibles para esto en este
    // formulario, se editan en el modal si hace falta cambiarlos.
    const [productName] = useState(initialName);
    const [manufacturerName] = useState(initialManufacturer);
    const [isUploading, setIsUploading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [importWarnings, setImportWarnings] = useState<string[]>([]);
    const [preview, setPreview] = useState<{ product: PreviewedLuminaireProduct; warnings: string[] } | null>(null);

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

        setIsUploading(true);

        try {
            const { product, warnings } = await previewPhotometryFile(formData);
            setPreview({ product, warnings: warnings ?? [] });
        } catch (error) {
            setImportError(extractErrorMessage(error, 'No se pudo leer el archivo fotométrico.'));
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = async (overrides: PhotometricPreviewOverrides) => {
        if (!selectedFile) return;

        setIsConfirming(true);
        setImportError(null);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('normative_standard', 'universal');
        if (overrides.name.trim()) formData.append('name', overrides.name.trim());
        if (overrides.manufacturer.trim()) formData.append('manufacturer', overrides.manufacturer.trim());
        if (overrides.total_lumens.trim()) formData.append('total_lumens', overrides.total_lumens.trim());
        if (overrides.power_watts.trim()) formData.append('power_watts', overrides.power_watts.trim());
        if (overrides.cct.trim()) formData.append('cct', overrides.cct.trim());
        if (overrides.cri_ra.trim()) formData.append('cri_ra', overrides.cri_ra.trim());
        if (overrides.lamp_type.trim()) formData.append('lamp_type', overrides.lamp_type.trim());
        if (overrides.fixture_shape) formData.append('fixture_shape', overrides.fixture_shape);
        if (overrides.dimension_length.trim()) formData.append('dimensions[length]', overrides.dimension_length.trim());
        if (overrides.dimension_width.trim()) formData.append('dimensions[width]', overrides.dimension_width.trim());
        if (overrides.dimension_height.trim()) formData.append('dimensions[height]', overrides.dimension_height.trim());
        if (overrides.dimension_radius.trim()) formData.append('dimensions[radius]', overrides.dimension_radius.trim());
        if (overrides.productImage) formData.append('product_image', overrides.productImage);
        if (overrides.brandLogo) formData.append('brand_logo', overrides.brandLogo);

        try {
            const { product, message, warnings } = await importPhotometryFile(formData);
            onImported(product);
            setPreview(null);
            setSelectedFile(null);
            setImportMessage(message ?? 'Producto importado correctamente.');
            setImportWarnings(warnings ?? []);
        } catch (error) {
            setImportError(extractErrorMessage(error, 'No se pudo importar el producto.'));
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <form
            onSubmit={submitProductImport}
            className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-700 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-slate-200 sm:p-4 [&_input:not([type='checkbox'])]:h-9 [&_input:not([type='checkbox'])]:rounded-lg [&_input:not([type='checkbox'])]:border-slate-300 [&_input:not([type='checkbox'])]:bg-white [&_input:not([type='checkbox'])]:px-3 [&_input:not([type='checkbox'])]:text-xs [&_input:not([type='checkbox'])]:text-slate-900 dark:[&_input:not([type='checkbox'])]:border-slate-300 dark:border-slate-700 dark:[&_input:not([type='checkbox'])]:bg-slate-200 dark:bg-slate-900 dark:[&_input:not([type='checkbox'])]:text-slate-900 dark:text-slate-100"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] text-amber-300/80">Importacion IES/LDT/GLDF</p>
                {isLoadingProducts && <span className="text-[8px] text-gray-500 dark:text-gray-500">Cargando...</span>}
            </div>
            <label className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-amber-700/30 bg-gray-300 dark:bg-gray-950/30 px-2 py-1 text-[9px] text-amber-100 hover:bg-amber-900/20">
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
            <p className="mt-1.5 text-[8px] leading-tight text-slate-500 dark:text-slate-500">
                Nombre, marca, imágenes, tipo de lámpara, curva polar y tabla UGR se revisan y editan en el siguiente paso, antes de guardar.
            </p>
            <button
                type="submit"
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-amber-700/70 py-1 text-[9px] text-amber-50 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedFile || isUploading}
            >
                <Upload size={9} />
                {isUploading ? 'Leyendo archivo...' : 'Leer y previsualizar'}
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
            {preview && (
                <PhotometricPreviewModal
                    open
                    mode="create"
                    onOpenChange={(open) => {
                        if (!open) setPreview(null);
                    }}
                    preview={preview.product}
                    warnings={preview.warnings}
                    isConfirming={isConfirming}
                    onConfirm={confirmImport}
                />
            )}
        </form>
    );
}
