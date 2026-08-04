import axios from 'axios';
import { useCallback, useState } from 'react';
import Swal from 'sweetalert2';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from '@/pages/dialux/domain/calculation/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import * as dialuxRoutes from '@/routes/dialux';
import { buildDialuxEmergencyDocument } from './document/buildDialuxEmergencyDocument';

export interface UseDialuxEmergencyPdfExportResult {
    exportEmergencyPdf: () => Promise<void>;
    isExporting: boolean;
    lastError: string | null;
}

/**
 * Exportador del informe de alumbrado de EMERGENCIA (Fase 14 del plan
 * maestro, §11 — puerta de salida: "los resultados de emergencia nunca se
 * confunden con iluminación normal"). Deliberadamente un hook SEPARADO de
 * `useDialuxPdfExport.ts` (no un flag sobre el mismo botón): corre el
 * motor con `emergencyMode: true` (flujo de emergencia, no el normal — ver
 * `runDirectPreviewEngine.ts`) y produce un `DialuxFormalDocument` distinto
 * (`buildDialuxEmergencyDocument.ts`), reutilizando el mismo endpoint/Blade
 * de exportación que el informe normal (mismo tipo de documento), pero con
 * un nombre de archivo y una portada que nunca coinciden con el informe
 * normal.
 */
export function useDialuxEmergencyPdfExport(): UseDialuxEmergencyPdfExportResult {
    const [isExporting, setIsExporting] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const exportEmergencyPdf = useCallback(async () => {
        const project = useEditorStore.getState().project;
        if (!project) {
            throw new Error('No hay un proyecto activo para exportar.');
        }

        setIsExporting(true);
        setLastError(null);

        Swal.fire({
            title: 'Generando informe de emergencia',
            html: '<div style="font-size:14px; color:#475569;">Calculando con flujo de emergencia...</div>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading(),
        });

        try {
            const { resultsByRoom: emergencyResultsByRoom } = await runProjectLightingCalculation(project, {
                ...DEFAULT_DIRECT_PREVIEW_CONFIG,
                emergencyMode: true,
            });

            const exportedAt = new Date().toISOString();
            const emergencyDocument = buildDialuxEmergencyDocument({
                project,
                emergencyResultsByRoom,
                exportedAt,
            });

            Swal.update({ html: '<div style="font-size:14px; color:#475569;">Generando PDF en servidor...</div>' });

            const response = await axios.post(
                dialuxRoutes.formalExport.url(),
                {
                    document: emergencyDocument,
                    dialux_project_id: project.id,
                },
                { responseType: 'blob' },
            );

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const headerValue = response.headers['content-disposition'];
            const matchedFileName =
                typeof headerValue === 'string' ? /filename="?([^"]+)"?/i.exec(headerValue)?.[1] : null;

            link.href = objectUrl;
            link.download = matchedFileName ?? `${emergencyDocument.fileBaseName}.pdf`;

            Swal.update({ html: '<div style="font-size:14px; color:#475569;">¡Completado! Descargando archivo...</div>' });
            setTimeout(() => {
                link.click();
                window.URL.revokeObjectURL(objectUrl);
                Swal.close();
            }, 500);
        } catch (error) {
            const axiosLike = error as { response?: { data?: unknown; status?: number } };
            let message = error instanceof Error ? error.message : 'No se pudo exportar el informe de emergencia.';

            if (axiosLike?.response?.data instanceof Blob) {
                try {
                    const text = await (axiosLike.response.data as Blob).text();
                    const parsed = JSON.parse(text) as Record<string, unknown>;
                    const validationErrors = parsed['errors'];
                    if (validationErrors && typeof validationErrors === 'object') {
                        const firstMessages = (Object.values(validationErrors) as string[][]).flat().slice(0, 4).join(' | ');
                        message = `Exportación rechazada por el servidor (${axiosLike.response.status}): ${firstMessages}`;
                    }
                } catch {
                    // Blob no era JSON válido — se conserva el mensaje genérico.
                }
            }

            setLastError(message);
            Swal.fire({
                icon: 'error',
                title: 'Error al exportar el informe de emergencia',
                text: message,
                confirmButtonColor: '#0d9488',
                confirmButtonText: 'Entendido',
            });
            throw error;
        } finally {
            setIsExporting(false);
        }
    }, []);

    return { exportEmergencyPdf, isExporting, lastError };
}
