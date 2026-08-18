import { useEffect, useState } from 'react';
import { extractErrorMessage, fetchFullProduct, updateLuminaire, type ImportedLuminaireProduct, type PhotometricWeb } from './catalogApi';
import { PhotometricPreviewModal, type PhotometricPreviewOverrides } from './PhotometricPreviewModal';

/**
 * Editor de una luminaria YA guardada con fotometría real (IES/LDT/GLDF) —
 * Ronda 21d. Reusa `PhotometricPreviewModal` en modo `edit`: busca el
 * producto completo (con `photometric_web`/`metadata`, que la lista del
 * catálogo no trae) y guarda vía `PATCH /products/{id}` — nunca vuelve a
 * subir el archivo original. Las luminarias `source_format === 'manual'`
 * (sin archivo real) NO usan este componente — siguen editándose con
 * `ManualLuminaireForm`, que sabe editar su curva sintética/manual.
 */

interface EditImportedLuminaireModalProps {
    productId: number;
    onSaved: (product: ImportedLuminaireProduct) => void;
    onCancel: () => void;
}

export function EditImportedLuminaireModal({ productId, onSaved, onCancel }: EditImportedLuminaireModalProps) {
    const [product, setProduct] = useState<(ImportedLuminaireProduct & { photometric_web?: PhotometricWeb | null }) | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchFullProduct(productId)
            .then((fetched) => {
                if (!cancelled) setProduct(fetched);
            })
            .catch((error) => {
                if (!cancelled) setLoadError(extractErrorMessage(error, 'No se pudo cargar la luminaria.'));
            });
        return () => {
            cancelled = true;
        };
    }, [productId]);

    const confirmEdit = async (overrides: PhotometricPreviewOverrides) => {
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', overrides.name.trim() || product?.name || '');
            if (overrides.manufacturer.trim()) formData.append('manufacturer', overrides.manufacturer.trim());
            if (overrides.total_lumens.trim()) formData.append('total_lumens', overrides.total_lumens.trim());
            if (overrides.power_watts.trim()) formData.append('power_watts', overrides.power_watts.trim());
            if (overrides.cct.trim()) formData.append('cct', overrides.cct.trim());
            if (overrides.cri_ra.trim()) formData.append('cri_ra', overrides.cri_ra.trim());
            if (overrides.lamp_type.trim()) formData.append('lamp_type', overrides.lamp_type.trim());

            if (overrides.productImage) formData.append('product_image', overrides.productImage);
            else if (overrides.clearProductImage) formData.append('clear_product_image', '1');

            if (overrides.brandLogo) formData.append('brand_logo', overrides.brandLogo);
            else if (overrides.clearBrandLogo) formData.append('clear_brand_logo', '1');

            if (overrides.replacementFile) formData.append('file', overrides.replacementFile);

            const { product: saved } = await updateLuminaire(productId, formData);
            onSaved(saved);
        } catch (error) {
            setLoadError(extractErrorMessage(error, 'No se pudo guardar la luminaria.'));
        } finally {
            setIsSaving(false);
        }
    };

    if (loadError && !product) {
        return null; // el error se pierde silenciosamente solo si nunca llegó a cargar — no hay modal que mostrarlo, se resuelve reintentando desde el catálogo.
    }
    if (!product) {
        return null; // cargando — sin modal parpadeante mientras llega la respuesta.
    }

    return (
        <PhotometricPreviewModal
            open
            mode="edit"
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
            preview={product}
            warnings={loadError ? [loadError] : []}
            isConfirming={isSaving}
            onConfirm={confirmEdit}
        />
    );
}
