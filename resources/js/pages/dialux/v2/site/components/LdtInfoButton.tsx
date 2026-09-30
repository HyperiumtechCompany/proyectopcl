import { FileSearch } from 'lucide-react';
import { EditImportedLuminaireModal } from '@/pages/dialux/features/luminaires/catalog/EditImportedLuminaireModal';

/**
 * Ficha completa del LDT/IES de un producto del catálogo — el MISMO modal de
 * la V1 (General · Luminaria · Lámparas · Distribución lumínica: tabla de
 * intensidades, curva polar, cartesiano, cono y UGR). Permite corregir los
 * datos del producto (nombre, flujo, potencia, foto…) sin volver a subir el
 * archivo. Las luminarias manuales (sin archivo) no tienen ficha LDT.
 */
export function LdtInfoButton({
    productId,
    sourceFormat,
    open,
    onOpenChange,
    onSaved,
}: {
    productId: number | undefined;
    sourceFormat: string | null | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Tras guardar cambios del producto (recargar el catálogo). */
    onSaved: () => void;
}) {
    if (productId === undefined || !sourceFormat || sourceFormat === 'manual') return null;
    return (
        <>
            <button
                type="button"
                onClick={() => onOpenChange(true)}
                title="Ver la información del archivo LDT/IES (como en la V1)"
                className="flex items-center gap-1 rounded border border-sky-300 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
                <FileSearch className="h-3 w-3" />
                Ficha LDT
            </button>
            {open && (
                <EditImportedLuminaireModal
                    productId={productId}
                    onSaved={() => {
                        onOpenChange(false);
                        onSaved();
                    }}
                    onCancel={() => onOpenChange(false)}
                />
            )}
        </>
    );
}
