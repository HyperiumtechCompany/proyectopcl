import { useCallback, useMemo, useState } from 'react';
import type { GanttTask } from '../types/task';
import type { GanttCalendarSettings } from '../types/calendar';
import {
    createDefaultCalendarSettings,
    normalizeCalendarSettings,
} from '../types/calendar';

function storageKey(projectId: string): string {
    return `pcl:gantt:v2:${projectId}:calendar-settings`;
}

export function useGanttSettings(projectId: string, tasks: GanttTask[]) {
    const fallbackSettings = useMemo(
        () => createDefaultCalendarSettings(tasks),
        [tasks],
    );

    const [calendarSettings, setCalendarSettingsState] =
        useState<GanttCalendarSettings>(() => {
            if (typeof window === 'undefined') {
                return fallbackSettings;
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
        },
        [fallbackSettings, projectId],
    );

    return {
        calendarSettings,
        setCalendarSettings,
    };
}
