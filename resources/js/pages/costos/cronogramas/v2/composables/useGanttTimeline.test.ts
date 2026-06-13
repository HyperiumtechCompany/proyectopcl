import { describe, expect, it } from 'vitest';
import { buildTimeline } from './useGanttTimeline';
import type { GanttCalendarSettings } from '../types/calendar';
import { DEFAULT_WORK_DAYS } from '../types/calendar';

describe('buildTimeline calendar settings', () => {
    it('marks configured holidays and non-working days in day zoom columns', () => {
        const settings: GanttCalendarSettings = {
            projectStart: '2026-06-08',
            projectEnd: '2026-06-14',
            workDays: {
                ...DEFAULT_WORK_DAYS,
                sun: { enabled: true, start: '08:00', end: '12:00' },
            },
            holidays: [{ id: 'h-1', date: '2026-06-10', name: 'Aniversario' }],
        };

        const timeline = buildTimeline(
            settings.projectStart,
            settings.projectEnd,
            20,
            'DAY_MONTH',
            settings,
        );

        const holiday = timeline.bottomCols.find(
            (col) => col.date === '2026-06-10',
        );
        const sunday = timeline.bottomCols.find(
            (col) => col.date === '2026-06-14',
        );

        expect(timeline.projectStart).toBe('2026-06-08');
        expect(timeline.projectEnd).toBe('2026-06-14');
        expect(holiday).toMatchObject({
            isHoliday: true,
            isNonWorking: true,
            holidayName: 'Aniversario',
        });
        expect(sunday).toMatchObject({
            isWeekend: true,
            isNonWorking: false,
        });
    });
});
