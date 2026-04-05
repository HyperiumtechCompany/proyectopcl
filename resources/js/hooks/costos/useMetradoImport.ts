import { useState } from 'react';

interface MetradoImportResult {
    success: boolean;
    imported: number;
    updated: number;
    errors: string[];
}

interface MetradoImportHook {
    importing: boolean;
    import: (metradoType: string) => Promise<MetradoImportResult>;
}

/**
 * Custom hook for importing metrado data into presupuesto_general
 * Provides a function to import metrado structure and manages loading state
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3**
 * 
 * @param projectId - The ID of the CostoProject
 * @returns Hook interface with importing state and import function
 */
export function useMetradoImport(projectId: number): MetradoImportHook {
    const [importing, setImporting] = useState(false);

    /**
     * Import metrado structure into presupuesto_general
     * Makes POST request to /costos/proyectos/{project}/presupuesto/import-metrado
     * 
     * @param metradoType - Type of metrado to import (e.g., 'metrado_arquitectura')
     * @returns Promise with import result containing success status, counts, and errors
     */
    const importMetrado = async (metradoType: string): Promise<MetradoImportResult> => {
        setImporting(true);

        try {
            const response = await fetch(
                `/costos/proyectos/${projectId}/presupuesto/import-metrado`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({ metrado_type: metradoType }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    imported: 0,
                    updated: 0,
                    errors: [data.message || 'Error al importar metrado'],
                };
            }

            if (data.success) {
                return {
                    success: true,
                    imported: data.summary?.created || 0,
                    updated: data.summary?.updated || 0,
                    errors: [],
                };
            } else {
                return {
                    success: false,
                    imported: 0,
                    updated: 0,
                    errors: [data.message || 'Error desconocido'],
                };
            }
        } catch (error) {
            return {
                success: false,
                imported: 0,
                updated: 0,
                errors: [error instanceof Error ? error.message : 'Error de red al importar metrado'],
            };
        } finally {
            setImporting(false);
        }
    };

    return {
        importing,
        import: importMetrado,
    };
}
