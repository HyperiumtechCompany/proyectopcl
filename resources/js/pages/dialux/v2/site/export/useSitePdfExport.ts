import axios from 'axios';
import { useState } from 'react';
import { formalExportModule } from '@/actions/App/Http/Controllers/Dialux/Editor2DController';
import { ensureStandardDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { activeRegions } from '../components/SiteNormPanels';
import { regionStandard } from '../domain/siteLightingNorms';
import type { SiteOutputRow } from '../domain/siteOutputs';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { useSiteLightingStore } from '../hooks/useSiteLightingCalculation';
import {
    loadLuminaireCatalog,
    type LuminaireCatalogItem,
} from '../lib/luminaireCatalog';
import { buildSiteFormalDocument } from './buildSiteFormalDocument';
import { rasterizeVectorAssets } from './rasterizeAssets';

/**
 * Informe PDF de la Planta General (D2): arma el documento formal en el
 * navegador y lo convierte en PDF con el MISMO endpoint del informe de la V1
 * para módulos v2 (`formalExportModule`, Módulo General).
 */
export function useSitePdfExport(editor: UseSiteEditorReturn) {
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const projectName = useEditorStore((state) => state.project?.name ?? '');
    const calculation = useSiteLightingStore((state) => state.calculation);
    const calculatedFor = useSiteLightingStore((state) => state.calculatedFor);

    const exportPdf = async () => {
        const site = editor.siteData;
        if (!site) return;
        setExporting(true);
        setError(null);
        try {
            const rows = new Map<string, SiteOutputRow>();
            for (const row of Object.values(editor.circuitOutputs ?? {})) {
                rows.set(`${row.panelElementId}:${row.rootConductorId}`, row);
            }
            // Nombre/fabricante de cada producto (catálogo compartido con la V1);
            // sin catálogo el informe sale igual, con "catálogo #id".
            const catalog = await loadLuminaireCatalog(false).catch(
                (): LuminaireCatalogItem[] => [],
            );
            // Catálogos de la norma elegida (Europa / EE.UU. / Perú vienen de
            // BD): sin esto, si no se abrió el panel de normativa, la actividad
            // elegida no se encuentra y la verificación sale "No evaluado".
            const regions = activeRegions(site);
            await Promise.all(
                regions
                    .filter((region) => region !== 'exterior')
                    .map((region) =>
                        ensureStandardDataLoaded(regionStandard(region)).catch(
                            () => undefined,
                        ),
                    ),
            );
            const built = buildSiteFormalDocument({
                products: new Map(catalog.map((item) => [item.id, item])),
                site,
                projectName,
                calculation,
                calculationStale:
                    calculation !== null && calculatedFor !== site,
                outputRows: [...rows.values()],
                regions,
            });
            // Dompdf no dibuja SVG: planos a imagen, como la V1.
            const document = {
                ...built,
                assets: await rasterizeVectorAssets(built.assets),
            };
            const response = await axios.post(
                formalExportModule.url({
                    dialuxProject: editor.projectId,
                    dialuxModule: editor.generalModuleId,
                }),
                { document, dialux_project_id: editor.projectId },
                { responseType: 'blob' },
            );
            const url = URL.createObjectURL(
                new Blob([response.data], { type: 'application/pdf' }),
            );
            const link = window.document.createElement('a');
            link.href = url;
            link.download = `${document.fileBaseName}.pdf`;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (caught) {
            let message = 'No se pudo generar el PDF.';
            if (
                axios.isAxiosError(caught) &&
                caught.response?.data instanceof Blob
            ) {
                try {
                    const body = JSON.parse(
                        await caught.response.data.text(),
                    ) as {
                        message?: string;
                        errors?: Record<string, string[]>;
                    };
                    // 422: se muestra el PRIMER campo rechazado (sin él, el
                    // mensaje genérico no permite saber qué dato falló).
                    const [field, detail] =
                        Object.entries(body.errors ?? {})[0] ?? [];
                    if (field)
                        message = `PDF rechazado (${caught.response.status}): ${field} — ${detail?.[0] ?? ''}`;
                    else if (body.message) message = body.message;
                } catch {
                    // respuesta no JSON: mensaje genérico
                }
            }
            setError(message);
        } finally {
            setExporting(false);
        }
    };

    return { exportPdf, exporting, error };
}
