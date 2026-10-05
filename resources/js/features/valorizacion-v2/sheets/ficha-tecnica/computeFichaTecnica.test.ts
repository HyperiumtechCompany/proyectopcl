import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 } from '../../data/fixtures/valorizacion02Jul2026';
import { computeFichaTecnica } from './computeFichaTecnica';

const ficha = valorizacion02Jul2026.fichaTecnica;

describe('computeFichaTecnica — hoja FT de la Val. N°02', () => {
    it('reproduce los campos calculados del Excel', () => {
        const ft = computeFichaTecnica(ficha);
        expect(ft.fechaTerminoProgramado).toBe('2026-08-18');
        expect(ft.plazoContractualTexto).toBe('SESENTA (60) DÍAS CALENDARIOS');
        expect(ft.plazoServicioTexto).toBe('NOVENTA (90) DÍAS CALENDARIOS');
        expect(ft.avance).toBeNull();
    });

    it('situación del avance (FT!E58/E59 vía Control General)', () => {
        const ft = computeFichaTecnica(ficha, { programado: '0.5650', ejecutado: '0.9782' });
        expect(ft.avance?.texto).toBe('ADELANTADA EN 41.32%');
    });

    it('ampliaciones y suspensiones corren el término vigente', () => {
        const ft = computeFichaTecnica({
            ...ficha,
            plazos: {
                ...ficha.plazos,
                ampliaciones: [{ id: 'a1', documento: 'AMP N°01', dias: 15 }],
                suspensiones: [{ id: 's1', documento: 'SUSP N°01', dias: 5 }],
            },
        });
        expect(ft.plazoVigenteDias).toBe(75);
        expect(ft.fechaTerminoProgramado).toBe('2026-08-18');
        expect(ft.fechaTerminoVigente).toBe('2026-09-07');
    });
});
