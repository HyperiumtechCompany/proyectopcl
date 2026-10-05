import { describe, expect, it } from 'vitest';
import { emptyHistory, HISTORY_LIMIT, record, redo, undo } from './history';

describe('history', () => {
    it('deshace y rehace en orden, con la etiqueta de la acción', () => {
        let history = record(emptyHistory<string>(), 'A', 'paso 1');
        history = record(history, 'B', 'paso 2');
        // estado actual: C
        const u1 = undo(history, 'C')!;
        expect(u1).toMatchObject({ state: 'B', label: 'paso 2' });
        const u2 = undo(u1.history, u1.state)!;
        expect(u2.state).toBe('A');
        expect(undo(u2.history, u2.state)).toBeNull();
        const r1 = redo(u2.history, u2.state)!;
        expect(r1).toMatchObject({ state: 'B', label: 'paso 1' });
        expect(redo(r1.history, r1.state)!.state).toBe('C');
    });

    it('un cambio nuevo borra lo que se podía rehacer', () => {
        const history = record(emptyHistory<string>(), 'A', 'x');
        const u = undo(history, 'B')!;
        const after = record(u.history, u.state, 'y');
        expect(after.future).toEqual([]);
    });

    it(`limita a ${HISTORY_LIMIT} pasos`, () => {
        let history = emptyHistory<number>();
        for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
            history = record(history, i, `p${i}`);
        }
        expect(history.past).toHaveLength(HISTORY_LIMIT);
        expect(history.past[0].state).toBe(20);
    });
});
