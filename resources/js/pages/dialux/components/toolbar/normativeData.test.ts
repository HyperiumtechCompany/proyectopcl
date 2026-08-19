import { describe, expect, it } from 'vitest';
import { getCategoryOptions } from '@/pages/dialux/hooks/roomLighting';
import { ALL_STANDARDS } from './normativeData';

describe('catÃ¡logos normativos del toolbar', () => {
    it.each([
        ['en_12464_1', 'Europa'],
        ['ies_na', 'Estados Unidos'],
        ['rne_peru', 'PerÃº'],
        ['en_1838', 'Emergencia europea'],
    ] as const)('%s dispone de Ã¡reas para %s', (standard, _region) => {
        expect(getCategoryOptions(standard).length).toBeGreaterThan(0);
    });

    it('cada estÃ¡ndar visible tiene secciones y aplicaciones seleccionables', () => {
        for (const standard of ALL_STANDARDS) {
            expect(standard.sections.length).toBeGreaterThan(0);
            for (const section of standard.sections) {
                const profiles = [
                    ...(section.profiles ?? []),
                    ...(section.subsections ?? []).flatMap(
                        (subsection) => subsection.profiles,
                    ),
                ];
                expect(profiles.length).toBeGreaterThan(0);
            }
        }
    });
});

