import { describe, expect, it } from 'vitest';
import type { ProjectSiteSettings } from '@/pages/dialux/hooks/types';
import { resolveMaintenanceFactor } from './maintenanceFactor';

describe('resolveMaintenanceFactor', () => {
    it('sin siteSettings: default 0.8 (comportamiento de siempre)', () => {
        expect(resolveMaintenanceFactor(undefined)).toBe(0.8);
    });

    it('con maintenanceFactor escalar, sin método CIE 97:2005: usa el escalar tal cual', () => {
        const siteSettings: ProjectSiteSettings = { maintenanceFactor: 0.75 };
        expect(resolveMaintenanceFactor(siteSettings)).toBe(0.75);
    });

    it('con maintenanceMethod cie_97_2005 pero SIN los 4 componentes: cae al escalar (o default)', () => {
        const siteSettings: ProjectSiteSettings = {
            maintenanceMethod: 'cie_97_2005',
            maintenanceFactor: 0.75,
            lightLossMaintenanceFactor: 0.9,
            // faltan luminaireSurvivalFactor/luminaireMaintenanceFactor/roomSurfaceMaintenanceFactor
        };
        expect(resolveMaintenanceFactor(siteSettings)).toBe(0.75);
    });

    it('con maintenanceMethod cie_97_2005 y los 4 componentes válidos: producto exacto', () => {
        const siteSettings: ProjectSiteSettings = {
            maintenanceMethod: 'cie_97_2005',
            maintenanceFactor: 0.75, // debe ignorarse — los componentes ganan
            lightLossMaintenanceFactor: 0.9,
            luminaireSurvivalFactor: 1.0,
            luminaireMaintenanceFactor: 0.85,
            roomSurfaceMaintenanceFactor: 0.9,
        };
        expect(resolveMaintenanceFactor(siteSettings)).toBeCloseTo(0.9 * 1.0 * 0.85 * 0.9, 10);
    });

    it('componente inválido (0, negativo, >1): cae al escalar/default en vez de propagar un valor imposible', () => {
        const siteSettingsZero: ProjectSiteSettings = {
            maintenanceMethod: 'cie_97_2005',
            lightLossMaintenanceFactor: 0,
            luminaireSurvivalFactor: 1,
            luminaireMaintenanceFactor: 0.9,
            roomSurfaceMaintenanceFactor: 0.9,
        };
        expect(resolveMaintenanceFactor(siteSettingsZero)).toBe(0.8);

        const siteSettingsOver1: ProjectSiteSettings = {
            maintenanceMethod: 'cie_97_2005',
            lightLossMaintenanceFactor: 1.2,
            luminaireSurvivalFactor: 1,
            luminaireMaintenanceFactor: 0.9,
            roomSurfaceMaintenanceFactor: 0.9,
        };
        expect(resolveMaintenanceFactor(siteSettingsOver1)).toBe(0.8);
    });

    it('con otro maintenanceMethod (ej. din_5035) aunque declare los 4 componentes: usa el escalar, no el producto', () => {
        const siteSettings: ProjectSiteSettings = {
            maintenanceMethod: 'din_5035',
            maintenanceFactor: 0.75,
            lightLossMaintenanceFactor: 0.9,
            luminaireSurvivalFactor: 1.0,
            luminaireMaintenanceFactor: 0.85,
            roomSurfaceMaintenanceFactor: 0.9,
        };
        expect(resolveMaintenanceFactor(siteSettings)).toBe(0.75);
    });
});
