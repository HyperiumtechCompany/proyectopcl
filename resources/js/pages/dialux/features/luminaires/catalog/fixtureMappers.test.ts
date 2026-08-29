import { describe, expect, it } from 'vitest';
import { isFixtureMatch } from '@/pages/dialux/components/catalogData';
import type { ImportedLuminaireProduct } from './catalogApi';
import { isImportedProductActive, productToFixtureFields } from './fixtureMappers';

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

describe('resaltado de ítem activo — catálogo vs importado no pueden estar activos a la vez', () => {
    it('un producto importado solo queda activo si su id coincide con productId de la plantilla', () => {
        const productA = buildProduct({ id: 10 });
        const productB = buildProduct({ id: 11 }); // mismas specs, distinto id

        const template = productToFixtureFields(productA);

        expect(isImportedProductActive(productA, template)).toBe(true);
        expect(isImportedProductActive(productB, template)).toBe(false);
    });

    it('sin productId en la plantilla (ej. ítem de catálogo estático), ningún importado queda activo', () => {
        const product = buildProduct({ id: 10 });

        expect(isImportedProductActive(product, { productId: undefined })).toBe(false);
    });

    it('con la plantilla apuntando a un producto importado, ningún ítem del catálogo estático coincide', () => {
        const template = productToFixtureFields(buildProduct({ id: 10, total_lumens: 6000, fixture_type: 'panel', fixture_shape: 'rectangular' }));
        const staticItem = { fixtureType: 'panel' as const, fixtureShape: 'rectangular' as const, lumens: 6000, catalogSymbol: 'rect_red' };

        expect(isFixtureMatch(staticItem, template)).toBe(false);
    });
});
