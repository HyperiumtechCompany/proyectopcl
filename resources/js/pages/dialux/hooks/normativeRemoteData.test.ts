import { afterEach, describe, expect, it } from 'vitest';
import { getActivityOptions, getNormativeOptions, getSectionOptions } from './roomLighting';
import { setNormDataOverride } from './normativeEngine';
import { buildTreeFromRows } from './normativeRemoteData';

/**
 * Ronda 21p — hallazgo real, no hipotético: en el proyecto "Vinchos", una
 * pared con la actividad normativa "Aulas para clases nocturnas y de
 * educación de adultos" (categoría EDUCACIÓN, SIN subcategoría real en BD
 * — `subcategory_key IS NULL`) terminó con `normativeSection` igual a
 * `normativeCategory` ("EDUCACIÓN"/"EDUCACIÓN") al elegirla en el editor.
 * Como la matriz de resolución de `ambientSpaces.ts`
 * (`ambientConfig?.uniformityTarget ?? activityOption?.uniformity ?? ...`)
 * busca la actividad filtrando por ESE `normativeSection` incorrecto, no
 * encontraba el registro real (Uo=0.60, UGR=19) y el ambiente terminaba sin
 * el requisito de uniformidad real aplicado — el panel en vivo mostraba
 * "Uo OK" para un Uo calculado muy por debajo del mínimo real de la norma,
 * sin que nada lo advirtiera. Exactamente el patrón "conforme sin fuente
 * normativa verificada" que este proyecto trata como bloqueante en otros
 * lugares.
 */
describe('normativeRemoteData — buildTreeFromRows (Ronda 21p, regresión real)', () => {
    afterEach(() => {
        // `setNormDataOverride` es un Map a nivel de módulo — sin este
        // limpiado, un test contamina el `getNormData('rne_peru')` de los
        // demás tests de este archivo (y potencialmente de otros).
        setNormDataOverride('rne_peru', []);
    });

    it('un área SIN subcategoría (subcategory_key null) queda con section=null, no con section=nombre de categoría', () => {
        const rows = [
            {
                id: 1124,
                standard: 'rne_peru',
                category_key: '2',
                category: 'EDUCACIÓN',
                subcategory_key: null,
                subcategory: null,
                area_name: 'Aulas para clases nocturnas y de educación de adultos',
                em_lux: 500,
                ugrl: 19,
                uo: 0.6,
                ra: 80,
                requirements: ['La iluminación debe ser controlable'],
            },
        ];

        setNormDataOverride('rne_peru', buildTreeFromRows(rows));

        const options = getNormativeOptions('rne_peru');
        const match = options.find((o) => o.activity === 'Aulas para clases nocturnas y de educación de adultos');

        expect(match).toBeDefined();
        expect(match!.section).toBeNull();
        expect(match!.category).toBe('EDUCACIÓN');
        expect(match!.uniformity).toBe(0.6);
        expect(match!.ugr).toBe(19);
        expect(match!.illuminanceLux).toBe(500);
    });

    it('getSectionOptions no ofrece una sección falsa para una categoría sin subcategorías reales', () => {
        const rows = [
            {
                id: 1124,
                standard: 'rne_peru',
                category_key: '2',
                category: 'EDUCACIÓN',
                subcategory_key: null,
                subcategory: null,
                area_name: 'Aulas para clases nocturnas y de educación de adultos',
                em_lux: 500,
                ugrl: 19,
                uo: 0.6,
                ra: 80,
                requirements: null,
            },
        ];
        setNormDataOverride('rne_peru', buildTreeFromRows(rows));

        // Antes del fix, esto devolvía ['EDUCACIÓN'] — una sección sintética
        // que no representa ninguna subcategoría real de la norma.
        expect(getSectionOptions('rne_peru', 'EDUCACIÓN')).toEqual([]);
    });

    it('getActivityOptions encuentra la actividad real pasando section=undefined (el caso correcto para un área sin subcategoría)', () => {
        const rows = [
            {
                id: 1124,
                standard: 'rne_peru',
                category_key: '2',
                category: 'EDUCACIÓN',
                subcategory_key: null,
                subcategory: null,
                area_name: 'Aulas para clases nocturnas y de educación de adultos',
                em_lux: 500,
                ugrl: 19,
                uo: 0.6,
                ra: 80,
                requirements: null,
            },
        ];
        setNormDataOverride('rne_peru', buildTreeFromRows(rows));

        const options = getActivityOptions('rne_peru', 'EDUCACIÓN', undefined);
        const match = options.find((o) => o.activity === 'Aulas para clases nocturnas y de educación de adultos');
        expect(match).toBeDefined();
        expect(match!.uniformity).toBe(0.6);
        expect(match!.ugr).toBe(19);
    });

    it('una categoría CON subcategorías reales sigue funcionando igual que antes (sin regresión)', () => {
        const rows = [
            {
                id: 1,
                standard: 'rne_peru',
                category_key: '2',
                category: 'EDUCACIÓN',
                subcategory_key: 'aulas',
                subcategory: 'Aulas',
                area_name: 'Salas de dibujo técnico',
                em_lux: 750,
                ugrl: 16,
                uo: 0.7,
                ra: 80,
                requirements: null,
            },
        ];
        setNormDataOverride('rne_peru', buildTreeFromRows(rows));

        const options = getNormativeOptions('rne_peru');
        const match = options.find((o) => o.activity === 'Salas de dibujo técnico');
        expect(match).toBeDefined();
        expect(match!.section).toBe('Aulas');
        expect(match!.uniformity).toBe(0.7);
    });

    it('mezcla de filas con y sin subcategoría en la misma categoría: las directas van a "General", no se pierden', () => {
        const rows = [
            {
                id: 1,
                standard: 'rne_peru',
                category_key: '2',
                category: 'EDUCACIÓN',
                subcategory_key: 'aulas',
                subcategory: 'Aulas',
                area_name: 'Salas de dibujo técnico',
                em_lux: 750,
                ugrl: 16,
                uo: 0.7,
                ra: 80,
                requirements: null,
            },
            {
                id: 2,
                standard: 'rne_peru',
                category_key: '2',
                category: 'EDUCACIÓN',
                subcategory_key: null,
                subcategory: null,
                area_name: 'Aulas para clases nocturnas y de educación de adultos',
                em_lux: 500,
                ugrl: 19,
                uo: 0.6,
                ra: 80,
                requirements: null,
            },
        ];
        setNormDataOverride('rne_peru', buildTreeFromRows(rows));

        const options = getNormativeOptions('rne_peru');
        const direct = options.find((o) => o.activity === 'Aulas para clases nocturnas y de educación de adultos');
        expect(direct).toBeDefined();
        expect(direct!.section).toBe('General');
        expect(direct!.uniformity).toBe(0.6);
    });
});
