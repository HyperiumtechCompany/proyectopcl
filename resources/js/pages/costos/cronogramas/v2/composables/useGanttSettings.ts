import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import type { GanttTask } from '../types/task';
import type { GanttCalendarSettings } from '../types/calendar';
import {
    createDefaultCalendarSettings,
    normalizeCalendarSettings,
} from '../types/calendar';

function storageKey(projectId: string): string {
    return `pcl:gantt:v2:${projectId}:calendar-settings`;
}

export function useGanttSettings(
    projectId: string,
    tasks: GanttTask[],
    initialSettings?: Partial<GanttCalendarSettings> | null,
) {
    const fallbackSettings = useMemo(
        () => createDefaultCalendarSettings(tasks),
        [tasks],
    );

    const [calendarSettings, setCalendarSettingsState] =
        useState<GanttCalendarSettings>(() => {
            if (typeof window === 'undefined') {
                return fallbackSettings;
            }

            if (initialSettings) {
                return normalizeCalendarSettings(initialSettings, fallbackSettings);
            }

            const stored = window.localStorage.getItem(storageKey(projectId));
            if (!stored) {
                return fallbackSettings;
            }

            try {
                return normalizeCalendarSettings(
                    JSON.parse(stored) as Partial<GanttCalendarSettings>,
                    fallbackSettings,
                );
            } catch {
                return fallbackSettings;
            }
        });

    const setCalendarSettings = useCallback(
        (next: GanttCalendarSettings) => {
            const normalized = normalizeCalendarSettings(
                next,
                fallbackSettings,
            );
            setCalendarSettingsState(normalized);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(
                    storageKey(projectId),
                    JSON.stringify(normalized),
                );
            }
            void axios.patch(`/cronograma/v2/${projectId}/settings`, {
                calendar_settings: normalized,
            }).catch((error) => {
                console.error('No se pudo guardar el calendario del cronograma.', error);
            });
        },
        [fallbackSettings, projectId],
    );

    return {
        calendarSettings,
        setCalendarSettings,
    };
}
