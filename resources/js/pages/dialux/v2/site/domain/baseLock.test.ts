import { describe, expect, it } from 'vitest';
import { isBaseLockActive, isElementFrozen } from './baseLock';
import type { SiteElement } from './types';

const el = (type: SiteElement['type'], locked?: boolean): SiteElement => ({
    id: type,
    type,
    label: type,
    vertices: [],
    locked,
    style: { fillColor: '#000', strokeColor: '#000' },
});

describe('site/domain/baseLock', () => {
    it('mientras solo hay base (terreno, cerco, plataformas) no se bloquea', () => {
        const site = { elements: [el('terrain'), el('fence'), el('terrace_platform')] };
        expect(isBaseLockActive(site)).toBe(false);
        expect(isElementFrozen(el('terrain'), site)).toBe(false);
    });

    it('en cuanto hay un objeto que no es base, la base queda bloqueada sola', () => {
        const site = { elements: [el('terrain'), el('terrace_platform'), el('building_block')] };
        expect(isBaseLockActive(site)).toBe(true);
        expect(isElementFrozen(el('terrace_platform'), site)).toBe(true);
        expect(isElementFrozen(el('building_block'), site)).toBe(false);
    });

    it('la decisión explícita del usuario manda sobre lo automático', () => {
        const withBuilding = [el('terrain'), el('building_block')];
        expect(isBaseLockActive({ baseLocked: false, elements: withBuilding })).toBe(false);
        expect(isBaseLockActive({ baseLocked: true, elements: [el('terrain')] })).toBe(true);
    });

    it('el bloqueo propio de un elemento siempre cuenta', () => {
        expect(isElementFrozen(el('building_block', true), { elements: [] })).toBe(true);
    });
});
