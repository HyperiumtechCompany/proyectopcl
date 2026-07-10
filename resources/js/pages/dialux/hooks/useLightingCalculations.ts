/**
 * useLightingCalculations.ts
 * 
 * Hook para gestionar el ciclo de vida completo de los cálculos de iluminación:
 * • Crear nuevos cálculos
 * • Guardar en localStorage
 * • Recuperar cálculos previos
 * • Exportar/Importar
 * • Limpiar datos
 */

import { useState, useCallback, useEffect } from 'react';
import type { RoomLightingCalculation } from '@/pages/dialux/hooks/useEditorStore';

interface UseLightingCalculationsOptions {
    projectId?: string;
    sceneId?: string;
}

interface LightingCalculationsStore {
    projectId: string;
    sceneId: string;
    calculations: RoomLightingCalculation[];
    updatedAt: string;
}

const STORAGE_KEY_PREFIX = 'dialux_lighting_calc_';

/**
 * Hook para gestionar cálculos de iluminación
 */
export function useLightingCalculations(
    { projectId = 'default', sceneId = 'default' }: UseLightingCalculationsOptions = {},
) {
    const [calculations, setCalculations] = useState<RoomLightingCalculation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastError, setLastError] = useState<string | null>(null);

    const storageKey = `${STORAGE_KEY_PREFIX}${projectId}_${sceneId}`;

    // ─── Cargar cálculos previos del localStorage ──────────────────────────────
    useEffect(() => {
        try {
            setIsLoading(true);
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const data: LightingCalculationsStore = JSON.parse(stored);
                setCalculations(data.calculations || []);
            }
        } catch (error) {
            setLastError(`Error al cargar cálculos: ${String(error)}`);
            console.error('Error loading calculations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [storageKey]);

    // ─── Guardar cálculos en localStorage ──────────────────────────────────────
    const saveCalculations = useCallback(
        (calcs: RoomLightingCalculation[]) => {
            try {
                const store: LightingCalculationsStore = {
                    projectId,
                    sceneId,
                    calculations: calcs,
                    updatedAt: new Date().toISOString(),
                };
                localStorage.setItem(storageKey, JSON.stringify(store));
                setCalculations(calcs);
                setLastError(null);
                return true;
            } catch (error) {
                setLastError(`Error al guardar cálculos: ${String(error)}`);
                console.error('Error saving calculations:', error);
                return false;
            }
        },
        [storageKey, projectId, sceneId],
    );

    // ─── Agregar nuevo cálculo ────────────────────────────────────────────────
    const addCalculation = useCallback(
        (calculation: RoomLightingCalculation) => {
            const updated = [...calculations, calculation];
            saveCalculations(updated);
            return calculation;
        },
        [calculations, saveCalculations],
    );

    // ─── Actualizar cálculo existente ─────────────────────────────────────────
    const updateCalculation = useCallback(
        (id: string, updates: Partial<RoomLightingCalculation>) => {
            const updated = calculations.map((c) =>
                c.id === id
                    ? {
                          ...c,
                          ...updates,
                          updatedAt: new Date().toISOString(),
                      }
                    : c,
            );
            saveCalculations(updated);
        },
        [calculations, saveCalculations],
    );

    // ─── Eliminar cálculo ────────────────────────────────────────────────────
    const deleteCalculation = useCallback(
        (id: string) => {
            const updated = calculations.filter((c) => c.id !== id);
            saveCalculations(updated);
        },
        [calculations, saveCalculations],
    );

    // ─── Limpiar todos los cálculos ──────────────────────────────────────────
    const clearAll = useCallback(() => {
        saveCalculations([]);
    }, [saveCalculations]);

    // ─── Exportar a JSON ──────────────────────────────────────────────────────
    const exportToJSON = useCallback((): string => {
        return JSON.stringify(
            {
                projectId,
                sceneId,
                exportedAt: new Date().toISOString(),
                calculations,
            },
            null,
            2,
        );
    }, [projectId, sceneId, calculations]);

    // ─── Exportar a CSV ───────────────────────────────────────────────────────
    const exportToCSV = useCallback((): string => {
        const headers = [
            'ID Recinto',
            'Nombre Recinto',
            'Área (m²)',
            'Norma (lx)',
            'Tipo Luminaria',
            'Lúmenes Foco',
            'Lúmenes Requeridos',
            'Cantidad Exacta',
            'Cantidad Redondeada',
            'Cantidad Recomendada',
            'Uniformidad (%)',
            'Cobertura',
            'Fecha Creación',
        ];

        const rows = calculations.map((c) => [
            c.roomId,
            c.name,
            c.area.toFixed(2),
            c.normaLux,
            c.fixtureType,
            c.fixtureLumens,
            c.lumensRequired,
            c.exactQuantity.toFixed(2),
            c.roundedQuantity,
            c.recommendedQuantity,
            ((c.uniformityEstimate || 0) * 100).toFixed(1),
            c.coverage,
            new Date(c.createdAt).toLocaleDateString('es-PE'),
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        return csvContent;
    }, [calculations]);

    // ─── Exportar a archivo ──────────────────────────────────────────────────
    const downloadFile = useCallback(
        (format: 'json' | 'csv' = 'json') => {
            const content = format === 'json' ? exportToJSON() : exportToCSV();
            const mimeType = format === 'json' ? 'application/json' : 'text/csv';
            const extension = format === 'json' ? 'json' : 'csv';

            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `dialux-iluminacion-${projectId}-${new Date().getTime()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        },
        [projectId, exportToJSON, exportToCSV],
    );

    // ─── Importar desde JSON ──────────────────────────────────────────────────
    const importFromJSON = useCallback(
        (jsonString: string) => {
            try {
                const data = JSON.parse(jsonString);
                if (Array.isArray(data.calculations)) {
                    saveCalculations(data.calculations);
                    return true;
                }
                throw new Error('Formato JSON inválido');
            } catch (error) {
                setLastError(`Error al importar: ${String(error)}`);
                return false;
            }
        },
        [saveCalculations],
    );

    // ─── Obtener estadísticas ────────────────────────────────────────────────
    const getStats = useCallback(
        () => ({
            totalCalculations: calculations.length,
            totalFixtures: calculations.reduce((sum, c) => sum + c.recommendedQuantity, 0),
            totalLumens: calculations.reduce((sum, c) => sum + c.lumensRequired, 0),
            averageArea:
                calculations.length > 0
                    ? calculations.reduce((sum, c) => sum + c.area, 0) / calculations.length
                    : 0,
            optimalCount: calculations.filter((c) => c.coverage === 'optimal').length,
            insufficientCount: calculations.filter((c) => c.coverage === 'insufficient').length,
            excessiveCount: calculations.filter((c) => c.coverage === 'excessive').length,
            averageUniformity:
                calculations.length > 0
                    ? (calculations.reduce((sum, c) => sum + (c.uniformityEstimate || 0), 0) /
                          calculations.length) *
                      100
                    : 0,
        }),
        [calculations],
    );

    // ─── Agrupar cálculos por recinto ─────────────────────────────────────────
    const groupByRoom = useCallback(
        () => {
            const grouped = new Map<
                string,
                {
                    roomId: string;
                    roomName: string;
                    calculations: RoomLightingCalculation[];
                }
            >();

            calculations.forEach((calc) => {
                if (!grouped.has(calc.roomId)) {
                    grouped.set(calc.roomId, {
                        roomId: calc.roomId,
                        roomName: calc.name,
                        calculations: [],
                    });
                }
                grouped.get(calc.roomId)!.calculations.push(calc);
            });

            return Array.from(grouped.values());
        },
        [calculations],
    );

    return {
        // Estado
        calculations,
        isLoading,
        lastError,

        // Operaciones CRUD
        addCalculation,
        updateCalculation,
        deleteCalculation,
        clearAll,

        // Exportar
        exportToJSON,
        exportToCSV,
        downloadFile,

        // Importar
        importFromJSON,

        // Utilidades
        getStats,
        groupByRoom,
    };
}

/**
 * Hook helper para exportar todo a archivo de texto formateado
 */
export function useFormattedLightingReport(calculations: RoomLightingCalculation[]) {
    const generateReport = useCallback((): string => {
        let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                 REPORTE PROFESIONAL DE ILUMINACIÓN - DIALUX                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

Generado: ${new Date().toLocaleString('es-PE')}
Total de Recintos: ${calculations.length}

`;

        calculations.forEach((calc, idx) => {
            report += `
${idx + 1}. ${calc.name.toUpperCase()}
${'═'.repeat(80)}

   Datos Generales:
   • Área: ${calc.area.toFixed(2)} m²
   • Altura: ${calc.scaledUnit}
   • Norma (EN 12464-1): ${calc.normaLux} lux
   
   Luminaria:
   • Tipo: ${calc.fixtureType}
   • Lúmenes: ${calc.fixtureLumens.toLocaleString('es-PE')} lm
   
   Cálculos:
   • Lúmenes Requeridos: ${calc.lumensRequired.toLocaleString('es-PE')} lm
   • Cantidad Exacta: ${calc.exactQuantity.toFixed(2)} unidades
   • Cantidad Redondeada: ${calc.roundedQuantity} unidades
   • Cantidad Recomendada: ${calc.recommendedQuantity} unidades ⭐
   
   Resultados:
   • Uniformidad: ${((calc.uniformityEstimate || 0) * 100).toFixed(1)}%
   • Cobertura: ${
            calc.coverage === 'optimal'
                ? '✓ ÓPTIMA'
                : calc.coverage === 'insufficient'
                  ? '⚠️ INSUFICIENTE'
                  : '⚠️ EXCESIVA'
        }
   • Estado: ${calc.coverage === 'optimal' ? '✅ CUMPLE' : '❌ REVISAR'}

`;
        });

        report += `
${'═'.repeat(80)}
Fórmula: ((Área × Norma) / 0.8) / 0.99 (Según EN 12464-1)
═════════════════════════════════════════════════════════════════════════════ 
`;

        return report;
    }, [calculations]);

    const downloadReport = useCallback(() => {
        const report = generateReport();
        const blob = new Blob([report], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte-iluminacion-${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    }, [generateReport]);

    return {
        generateReport,
        downloadReport,
    };
}
