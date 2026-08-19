import { describe, expect, it } from 'vitest';
import type { ImportedLuminaireProduct } from './catalogApi';
import { productToFixtureFields } from './fixtureMappers';

function buildProduct(overrides: Partial<ImportedLuminaireProduct> = {}): ImportedLuminaireProduct {
    return {
        id: 1,
        name: 'Downlight de prueba',
        manufacturer: 'Regiolux',
        catalog_number: '37672106640',
        source_format: 'ldt',
        total_lumens: 2014,
        power_watts: 21,
        cct: '4000K',
        fixture_type: 'recessed',
        fixture_shape: 'round',
        efficiency: 95.9,
        ...overrides,
    };
}

describe('Ronda 21j — productToFixtureFields copia metadata/luminous_opening', () => {
    it('copia metadata (tipo de lámpara, DFF/LORL, etc.) al colocar la luminaria en el plano', () => {
        const product = buildProduct({
            metadata: {
                parser: 'rust',
                num_lamps: 1,
                lamp_type: '14W LED',
                luminaire_type: 1,
                downward_flux_fraction_pct: 62.5,
                light_output_ratio_pct: 88,
                conversion_factor: 1,
                tilt_deg: 0,
            },
        });

        const fields = productToFixtureFields(product);

        expect(fields.metadata).toEqual(product.metadata);
    });

    it('copia luminous_opening (área luminosa real) al colocar la luminaria en el plano', () => {
        const product = buildProduct({
            luminous_opening: { length: 0.19, width: 0.19, height_c0: 0.02, height_c90: 0.02, height_c180: 0.02, height_c270: 0.02 },
        });

        const fields = productToFixtureFields(product);

        expect(fields.luminousOpening).toEqual(product.luminous_opening);
    });

    it('sin metadata/luminous_opening en el producto (ej. luminaria manual), no inventa datos', () => {
        const product = buildProduct();

        const fields = productToFixtureFields(product);

        expect(fields.metadata).toBeNull();
        expect(fields.luminousOpening).toBeNull();
    });

    it('copia cri_ra (CRI/Ra declarado por fábrica) al colocar la luminaria en el plano — mismo patrón que metadata/luminous_opening: un campo nuevo del producto que faltaba en este mapeo quedaba en 0 en el panel de propiedades aunque la BD lo tuviera correcto', () => {
        const product = buildProduct({ cri_ra: 100 });

        const fields = productToFixtureFields(product);

        expect(fields.cri).toBe(100);
    });

    it('sin cri_ra en el producto, no inventa un valor (queda null, no 0)', () => {
        const product = buildProduct();

        const fields = productToFixtureFields(product);

        expect(fields.cri).toBeNull();
    });
});
