/**
 * useNormativeConfig.ts
 *
 * Hook React para sincronizar la configuración normativa del proyecto
 * entre el store Zustand y el backend Laravel.
 */

import { router } from '@inertiajs/react';
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
                    signal: abortRef.current.signal,
                },
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = (await response.json()) as { data: ProjectNormativeConfig | null; exists: boolean };

            if (json.exists && json.data) {
                const data = json.data;
                setProjectNormativeConfig({
                    dialuxProjectId: data.dialuxProjectId ?? dialuxProjectId,
                    countryCode: data.countryCode ?? 'PE',
                    region: data.region ?? 'americas_peru',
                    installationType: data.installationType ?? null,
                    primaryStandard: data.primaryStandard ?? 'rne_peru',
                    referenceStandards: data.referenceStandards ?? [],
                    priorityOrder: data.priorityOrder ?? [],
                    autoDetectEnabled: data.autoDetectEnabled ?? true,
                    crossNormComparisonEnabled: data.crossNormComparisonEnabled ?? true,
                    normativeVersion: data.normativeVersion ?? null,
                    normsConsultedAt: data.normsConsultedAt ?? null,
                    disclaimer: data.disclaimer ?? null,
                    notes: data.notes ?? null,
                    complianceSummary: data.complianceSummary ?? {
                        totalRooms: 0,
                        compliantRooms: 0,
                        nonCompliantRooms: 0,
                        warningRooms: 0,
                        needsReviewRooms: 0,
                    },
                });
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
                const csrfMeta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
                const csrfToken = csrfMeta?.content ?? '';

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
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
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
    };
}
