import axios from 'axios';
import { useState } from 'react';
import { formalExportModule } from '@/actions/App/Http/Controllers/Dialux/Editor2DController';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { activeRegions } from '../components/SiteNormPanels';
import type { SiteOutputRow } from '../domain/siteOutputs';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { useSiteLightingStore } from '../hooks/useSiteLightingCalculation';
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
            const built = buildSiteFormalDocument({
                site,
                projectName,
                calculation,
                calculationStale: calculation !== null && calculatedFor !== site,
                outputRows: [...rows.values()],
                regions: activeRegions(site),
            });
            // Dompdf no dibuja SVG: planos a imagen, como la V1.
            const document = { ...built, assets: await rasterizeVectorAssets(built.assets) };
            const response = await axios.post(
                formalExportModule.url({
                    dialuxProject: editor.projectId,
                    dialuxModule: editor.generalModuleId,
                }),
                { document, dialux_project_id: editor.projectId },
                { responseType: 'blob' },
            );
            const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = window.document.createElement('a');
            link.href = url;
            link.download = `${document.fileBaseName}.pdf`;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (caught) {
            let message = 'No se pudo generar el PDF.';
            if (axios.isAxiosError(caught) && caught.response?.data instanceof Blob) {
                try {
                    const body = JSON.parse(await caught.response.data.text()) as { message?: string };
                    if (body.message) message = body.message;
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
