import { describe, expect, it } from 'vitest';
import type { GanttCalendarSettings } from './calendar';
import {
    addWorkingDays,
    buildWorkingDateSegments,
    DEFAULT_WORK_DAYS,
    diffWorkingDaysInclusive,
} from './calendar';

const mondayToFridaySettings: GanttCalendarSettings = {
    projectStart: '2026-06-08',
    projectEnd: '2026-06-21',
    workDays: DEFAULT_WORK_DAYS,
    holidays: [],
};

describe('working day calendar calculations', () => {
    it('extends task duration across weekend rest days', () => {
        expect(addWorkingDays('2026-06-08', 10, mondayToFridaySettings)).toBe(
            '2026-06-19',
        );
    });

    it('counts only configured working days in an inclusive range', () => {
        expect(
            diffWorkingDaysInclusive(
                '2026-06-08',
                '2026-06-21',
                mondayToFridaySettings,
            ),
        ).toBe(10);
    });

    it('splits visible task bars around non-working days', () => {
        expect(
            buildWorkingDateSegments(
                '2026-06-08',
                '2026-06-19',
                mondayToFridaySettings,
            ),
        ).toEqual([
            { start: '2026-06-08', end: '2026-06-12' },
            { start: '2026-06-15', end: '2026-06-19' },
        ]);
    });
});
