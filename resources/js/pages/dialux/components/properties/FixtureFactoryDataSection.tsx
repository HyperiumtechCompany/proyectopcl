import { FileText } from 'lucide-react';
import React from 'react';
import { LUMINAIRE_TYPE_LABELS } from '@/pages/dialux/features/luminaires/catalog/PhotometricPreviewModal';
import type { Fixture } from '@/pages/dialux/hooks/useEditorStore';
import { PropField } from './PropertyFields';

/**
 * Datos EULUMDAT/IES de fábrica para una luminaria YA insertada en el plano
 * (Ronda 21j) — hasta esta ronda, `productToFixtureFields()` no copiaba
 * `metadata`/`luminousOpening` del producto al colocarlo, así que esta
 * información (tipo de lámpara, DFF/LORL, área luminosa real) solo era
 * visible en el modal de importación/edición del catálogo, nunca en
 * Propiedades para una luminaria del plano. Solo lectura: editar estos
 * campos vive en el modal de edición del producto de catálogo, no aquí.
 */
export const FixtureFactoryDataSection: React.FC<{ fixture: Fixture }> = ({ fixture }) => {
    const metadata = fixture.metadata;
    const opening = fixture.luminousOpening;
    if (!metadata && !opening) {
        return null;
    }

    const luminaireType = metadata?.luminaire_type;

    return (
        <div className="my-2 space-y-1.5 border-t border-gray-300 pt-2 dark:border-gray-800/60">
            <div className="flex items-center gap-1.5">
                <FileText size={11} className="text-purple-600/80 dark:text-purple-400/80" />
                <p className="text-[9px] font-semibold tracking-wider text-purple-600/80 uppercase dark:text-purple-400/80">
                    Datos de fábrica (LDT/IES)
                </p>
            </div>
            {metadata?.lamp_type && <PropField label="Tipo de lámpara" value={metadata.lamp_type} mono={false} />}
            {metadata?.num_lamps != null && <PropField label="N.º de lámparas" value={String(metadata.num_lamps)} />}
            {luminaireType != null && (
                <PropField label="Forma (Ityp)" value={LUMINAIRE_TYPE_LABELS[luminaireType] ?? `Código ${luminaireType}`} mono={false} />
            )}
            {opening && (
                <PropField label="Área luminosa (L×A)" value={`${opening.length.toFixed(3)} × ${opening.width.toFixed(3)} m`} />
            )}
            {metadata?.downward_flux_fraction_pct != null && (
                <PropField label="DFF — flujo hacia abajo" value={`${metadata.downward_flux_fraction_pct.toFixed(1)}%`} />
            )}
            {metadata?.light_output_ratio_pct != null && (
                <PropField label="LORL — rendimiento" value={`${metadata.light_output_ratio_pct.toFixed(1)}%`} />
            )}
            {metadata?.conversion_factor != null && (
                <PropField label="Factor de conversión" value={metadata.conversion_factor.toFixed(3)} />
            )}
            {metadata?.tilt_deg != null && <PropField label="Inclinación (tilt)" value={`${metadata.tilt_deg.toFixed(1)}°`} />}
        </div>
    );
};
