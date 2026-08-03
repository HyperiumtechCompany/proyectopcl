/**
 * useNormativeConfig.ts
 *
 * Hook React para sincronizar la configuración normativa del proyecto
 * entre el store Zustand y el backend Laravel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectNormativeConfig } from './types';
import { useEditorStore } from './useEditorStore';

interface UseNormativeConfigReturn {
    config: ProjectNormativeConfig | null;
    isSaving: boolean;
    isLoading: boolean;
    error: string | null;
    saveConfig: (patch: Partial<ProjectNormativeConfig>) => Promise<void>;
    loadConfig: (dialuxProjectId: string) => Promise<void>;
    saveComplianceSummary: (
        dialuxProjectId: string,
        summary: ProjectNormativeConfig['complianceSummary'],
    ) => Promise<void>;
}

/**
 * El meta tag `csrf-token` se estampa una sola vez y queda obsoleto en
 * sesiones SPA largas (419). La cookie `XSRF-TOKEN` se renueva en cada
 * respuesta — mismo criterio que useDialuxProjectSync.
 */
function readXsrfTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

/** Fila del modelo Eloquent (snake_case) tal como la devuelve el backend. */
interface BackendNormativeConfig {
    dialux_project_id: string;
    country_code: string | null;
    region: string | null;
    installation_type: string | null;
    primary_standard: string | null;
    reference_standards: string[] | null;
    priority_order: string[] | null;
    auto_detect_enabled: boolean | number | null;
    cross_norm_comparison_enabled: boolean | number | null;
    total_rooms: number | null;
    compliant_rooms: number | null;
    non_compliant_rooms: number | null;
    warning_rooms: number | null;
    needs_review_rooms: number | null;
    normative_version: string | null;
    norms_consulted_at: string | null;
    disclaimer: string | null;
    notes: string | null;
}

function mapBackendConfig(data: BackendNormativeConfig, dialuxProjectId: string): ProjectNormativeConfig {
    return {
        dialuxProjectId: data.dialux_project_id ?? dialuxProjectId,
        countryCode: data.country_code ?? 'PE',
        region: (data.region as ProjectNormativeConfig['region']) ?? 'americas_peru',
        installationType: data.installation_type ?? null,
        primaryStandard: (data.primary_standard as ProjectNormativeConfig['primaryStandard']) ?? 'rne_peru',
        referenceStandards: (data.reference_standards as ProjectNormativeConfig['referenceStandards']) ?? [],
        priorityOrder: data.priority_order ?? [],
        autoDetectEnabled: Boolean(data.auto_detect_enabled ?? true),
        crossNormComparisonEnabled: Boolean(data.cross_norm_comparison_enabled ?? true),
        normativeVersion: data.normative_version ?? null,
        normsConsultedAt: data.norms_consulted_at ?? null,
        disclaimer: data.disclaimer ?? null,
        notes: data.notes ?? null,
        complianceSummary: {
            totalRooms: data.total_rooms ?? 0,
            compliantRooms: data.compliant_rooms ?? 0,
            nonCompliantRooms: data.non_compliant_rooms ?? 0,
            warningRooms: data.warning_rooms ?? 0,
            needsReviewRooms: data.needs_review_rooms ?? 0,
        },
    };
}

export function useNormativeConfig(): UseNormativeConfigReturn {
    const projectNormativeConfig = useEditorStore((s) => s.projectNormativeConfig);
    const setProjectNormativeConfig = useEditorStore((s) => s.setProjectNormativeConfig);
    const updateComplianceSummary = useEditorStore((s) => s.updateComplianceSummary);

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    /** Carga la config desde el backend para un proyecto dado */
    const loadConfig = useCallback(async (dialuxProjectId: string): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            abortRef.current?.abort();
            abortRef.current = new AbortController();

            const response = await fetch(
                `/dialux/normative-config/${dialuxProjectId}`,
                {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin',
                    signal: abortRef.current.signal,
                },
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = (await response.json()) as { data: BackendNormativeConfig | null; exists: boolean };

            if (json.exists && json.data) {
                setProjectNormativeConfig(mapBackendConfig(json.data, dialuxProjectId));
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                setError('No se pudo cargar la configuración normativa.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [setProjectNormativeConfig]);

    /** Guarda o actualiza la config en el backend */
    const saveConfig = useCallback(
        async (patch: Partial<ProjectNormativeConfig>): Promise<void> => {
            setIsSaving(true);
            setError(null);

            const merged: ProjectNormativeConfig = {
                ...(projectNormativeConfig ?? {
                    dialuxProjectId: '',
                    countryCode: 'PE',
                    region: 'americas_peru',
                    installationType: null,
                    primaryStandard: 'rne_peru',
                    referenceStandards: [],
                    priorityOrder: [],
                    autoDetectEnabled: true,
                    crossNormComparisonEnabled: true,
                    normativeVersion: null,
                    normsConsultedAt: null,
                    disclaimer: null,
                    notes: null,
                    complianceSummary: {
                        totalRooms: 0, compliantRooms: 0, nonCompliantRooms: 0,
                        warningRooms: 0, needsReviewRooms: 0,
                    },
                }),
                ...patch,
            };

            // Actualizar store inmediatamente (optimistic update)
            setProjectNormativeConfig(merged);

            try {
                const body = {
                    dialux_project_id:              merged.dialuxProjectId,
                    country_code:                   merged.countryCode,
                    region:                         merged.region,
                    installation_type:              merged.installationType,
                    primary_standard:               merged.primaryStandard,
                    reference_standards:            merged.referenceStandards,
                    priority_order:                 merged.priorityOrder,
                    auto_detect_enabled:            merged.autoDetectEnabled,
                    cross_norm_comparison_enabled:  merged.crossNormComparisonEnabled,
                    normative_version:              merged.normativeVersion,
                    norms_consulted_at:             merged.normsConsultedAt,
                    disclaimer:                     merged.disclaimer,
                    notes:                          merged.notes,
                };

                const response = await fetch('/dialux/normative-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error((errJson as { message?: string }).message ?? `HTTP ${response.status}`);
                }
            } catch (err) {
                setError((err as Error).message ?? 'Error al guardar la configuración normativa.');
            } finally {
                setIsSaving(false);
            }
        },
        [projectNormativeConfig, setProjectNormativeConfig],
    );

    /**
     * Persiste el resumen de cumplimiento (verde/amarillo/rojo por ambiente)
     * en el backend y lo refleja en el store. Requiere que la config exista
     * (el backend responde 404 si aún no se aplicó ninguna norma).
     */
    const saveComplianceSummary = useCallback(
        async (dialuxProjectId: string, summary: ProjectNormativeConfig['complianceSummary']): Promise<void> => {
            updateComplianceSummary(summary);

            try {
                const response = await fetch(`/dialux/normative-config/${dialuxProjectId}/compliance`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        total_rooms: summary.totalRooms,
                        compliant_rooms: summary.compliantRooms,
                        non_compliant_rooms: summary.nonCompliantRooms,
                        warning_rooms: summary.warningRooms,
                        needs_review_rooms: summary.needsReviewRooms,
                    }),
                });

                if (!response.ok && response.status !== 404) {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch {
                // El resumen es un caché: si falla el guardado no bloqueamos la UI.
            }
        },
        [updateComplianceSummary],
    );

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    return {
        config: projectNormativeConfig,
        isSaving,
        isLoading,
        error,
        saveConfig,
        loadConfig,
        saveComplianceSummary,
    };
}
