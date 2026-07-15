import {
    Circle,
    Square,
    Maximize2,
    Minimize2,
    Columns,
    ArrowRight,
    Frame,
    LayoutGrid,
    Shield,
    Layers,
    ToggleLeft,
    Box,
} from 'lucide-react';
import React from 'react';
import type { CorridorConfig } from '@/pages/dialux/hooks/types';
import type { Fixture, Window, Door, LightSwitch, JunctionBox } from '@/pages/dialux/hooks/useEditorStore';

export interface FixtureCatalogItem {
    label: string;
    brand: string;
    icon: React.ReactNode;
    lumens: number;
    power?: number;
    cct?: string;
    template: Partial<Fixture>;
}

export interface CorridorCatalogItem {
    label: string;
    description: string;
    icon: React.ReactNode;
    template: CorridorConfig;
}

// ── Símbolo SVG inline del catálogo (miniatura 16×16) ────────────────────────
export const CatalogSymbolIcon: React.FC<{ symbol: string }> = ({ symbol }) => {
    switch (symbol) {
        case 'rect_red':
            return <svg width="16" height="10" viewBox="0 0 16 10"><rect x="1" y="1" width="14" height="8" fill="none" stroke="#ef4444" strokeWidth="1.5" /></svg>;
        case 'rect_green':
            return <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="#22c55e" strokeWidth="1.5" /></svg>;
        case 'rect_white':
            return <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="#e5e7eb" strokeWidth="1.5" /></svg>;
        case 'circle_black':
            return <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#1f2937" stroke="#374151" strokeWidth="1" /></svg>;
        case 'circle_magenta':
            return <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="#d946ef" strokeWidth="1.5" /></svg>;
        case 'spot_yellow':
            return <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="#eab308" strokeWidth="1.5" /><line x1="7" y1="1" x2="7" y2="13" stroke="#eab308" strokeWidth="0.8" /><line x1="1" y1="7" x2="13" y2="7" stroke="#eab308" strokeWidth="0.8" /></svg>;
        case 'spot_orange':
            return <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="#f97316" strokeWidth="1.5" /><line x1="7" y1="2" x2="7" y2="12" stroke="#f97316" strokeWidth="0.8" /></svg>;
        case 'emergency':
            return <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="none" stroke="#10b981" strokeWidth="1.2" /><line x1="2" y1="2" x2="12" y2="12" stroke="#10b981" strokeWidth="1.2" /><line x1="12" y1="2" x2="2" y2="12" stroke="#10b981" strokeWidth="1.2" /></svg>;
        case 'emergency_perm':
            return <svg width="16" height="10" viewBox="0 0 16 10"><rect x="1" y="1" width="14" height="8" fill="none" stroke="#10b981" strokeWidth="1.2" /><text x="8" y="7" textAnchor="middle" fontSize="5" fill="#10b981">S</text></svg>;
        default:
            return <Circle size={13} />;
    }
};

export const fixtureCatalog: FixtureCatalogItem[] = [
    // ── Paneles LED empotrados ────────────────────────────────────────────────
    {
        label: 'Led 54W — 0.60×1.20m empotrado',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="rect_red" />,
        lumens: 6000,
        power: 54,
        cct: '6500K',
        template: {
            name: 'Led 54W 0.60×1.20m',
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lumens: 6000,
            power: 54,
            efficiency: 0.9,
            lightColor: '#f0f8ff',
            dimensions: { length: 1.2, width: 0.6, height: 0.06 },
            mountingHeight: 3.5,
            ip: 'IP20',
            ik: 'IK02',
            catalogSymbol: 'rect_red',
        },
    },
    {
        label: 'Led 36W — 0.60×0.60m empotrado',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="rect_green" />,
        lumens: 4320,
        power: 36,
        cct: '6500K',
        template: {
            name: 'Led 36W 0.60×0.60m',
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lumens: 4320,
            power: 36,
            efficiency: 0.9,
            lightColor: '#f0f8ff',
            dimensions: { length: 0.6, width: 0.6, height: 0.06 },
            mountingHeight: 3.5,
            ip: 'IP20',
            ik: 'IK02',
            catalogSymbol: 'rect_green',
        },
    },
    {
        label: 'Led 26W — 0.20×0.20m empotrado',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="rect_white" />,
        lumens: 2580,
        power: 26,
        cct: '6500K',
        template: {
            name: 'Led 26W 0.20×0.20m',
            fixtureType: 'panel',
            fixtureShape: 'square',
            lumens: 2580,
            power: 26,
            efficiency: 0.9,
            lightColor: '#f0f8ff',
            dimensions: { length: 0.2, width: 0.2, height: 0.05 },
            mountingHeight: 3.5,
            ip: 'IP20',
            ik: 'IK02',
            catalogSymbol: 'rect_white',
        },
    },
    // ── Downlights ───────────────────────────────────────────────────────────
    {
        label: 'Downlight adosada 14W — D=190mm',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="circle_black" />,
        lumens: 1508,
        power: 14,
        cct: '6500K',
        template: {
            name: 'Downlight adosada 14W',
            fixtureType: 'surface',
            fixtureShape: 'round',
            lumens: 1508,
            power: 14,
            efficiency: 0.88,
            lightColor: '#f0f8ff',
            dimensions: { length: 0.19, width: 0.19, height: 0.08 },
            mountingHeight: 3.5,
            ip: 'IP20',
            ik: 'IK02',
            catalogSymbol: 'circle_black',
        },
    },
    {
        label: 'Downlight empotrado 21W — D=190mm',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="circle_magenta" />,
        lumens: 2014,
        power: 21,
        cct: '6500K',
        template: {
            name: 'Downlight empotrado 21W',
            fixtureType: 'recessed',
            fixtureShape: 'round',
            lumens: 2014,
            power: 21,
            efficiency: 0.88,
            lightColor: '#f0f8ff',
            dimensions: { length: 0.19, width: 0.19, height: 0.1 },
            mountingHeight: 3.5,
            ip: 'IP20',
            ik: 'IK02',
            catalogSymbol: 'circle_magenta',
        },
    },
    // ── Reflectores ──────────────────────────────────────────────────────────
    {
        label: 'Reflector 330W — 38500lm adosado',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="spot_yellow" />,
        lumens: 38500,
        power: 330,
        cct: '6500K',
        template: {
            name: 'Reflector 330W',
            fixtureType: 'spot',
            fixtureShape: 'round',
            lumens: 38500,
            power: 330,
            efficiency: 0.9,
            lightColor: '#fefce8',
            dimensions: { length: 0.4, width: 0.4, height: 0.2 },
            mountingHeight: 4.5,
            ip: 'IP65',
            ik: 'IK07',
            catalogSymbol: 'spot_yellow',
        },
    },
    {
        label: 'Reflector 51W — 6505lm empotrado',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="spot_orange" />,
        lumens: 6505,
        power: 51,
        cct: '6500K',
        template: {
            name: 'Reflector 51W',
            fixtureType: 'recessed',
            fixtureShape: 'round',
            lumens: 6505,
            power: 51,
            efficiency: 0.88,
            lightColor: '#fefce8',
            dimensions: { length: 0.2, width: 0.2, height: 0.15 },
            mountingHeight: 3.2,
            ip: 'IP42',
            ik: 'IK02',
            catalogSymbol: 'spot_orange',
        },
    },
    // ── Emergencia ───────────────────────────────────────────────────────────
    {
        label: 'Emergencia 20W — IP42 IK07',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="emergency" />,
        lumens: 700,
        power: 20,
        cct: '6500K',
        template: {
            name: 'Emergencia 20W',
            fixtureType: 'surface',
            fixtureShape: 'rectangular',
            lumens: 700,
            power: 20,
            efficiency: 0.85,
            lightColor: '#d1fae5',
            dimensions: { length: 0.3, width: 0.12, height: 0.06 },
            mountingHeight: 3.0,
            ip: 'IP42',
            ik: 'IK07',
            catalogSymbol: 'emergency',
            emergencyType: 'emergency',
        },
    },
    {
        label: 'Emergencia permanente — 0.37×0.20m',
        brand: 'Catálogo',
        icon: <CatalogSymbolIcon symbol="emergency_perm" />,
        lumens: 400,
        power: 8,
        cct: '6500K',
        template: {
            name: 'Emergencia permanente',
            fixtureType: 'surface',
            fixtureShape: 'rectangular',
            lumens: 400,
            power: 8,
            efficiency: 0.85,
            lightColor: '#d1fae5',
            dimensions: { length: 0.37, width: 0.20, height: 0.06 },
            mountingHeight: 3.5,
            ip: 'IP42',
            ik: 'IK07',
            catalogSymbol: 'emergency_perm',
            emergencyType: 'permanent',
        },
    },
];

// ── Catálogo de interruptores ─────────────────────────────────────────────────

export interface SwitchCatalogItem {
    label: string;
    description: string;
    icon: React.ReactNode;
    switchLabel: string;
    type: LightSwitch['type'];
}

export const switchCatalog: SwitchCatalogItem[] = [
    {
        label: 'Interruptor simple',
        description: 'S(a) — Altura 1.40m',
        icon: <ToggleLeft size={13} />,
        switchLabel: 'S(a)',
        type: 'single',
    },
    {
        label: 'Interruptor conmutador',
        description: 'Sc(a) — Altura 1.40m',
        icon: <ToggleLeft size={13} className="text-violet-400" />,
        switchLabel: 'Sc(a)',
        type: 'two-way',
    },
    {
        label: 'Interruptor doble bipolar',
        description: '2S(a) — Altura 1.40m',
        icon: <ToggleLeft size={13} className="text-sky-400" />,
        switchLabel: '2S(a)',
        type: 'double',
    },
];

// ── Catálogo de cajas de pase ─────────────────────────────────────────────────

export interface JunctionBoxCatalogItem {
    label: string;
    description: string;
    icon: React.ReactNode;
    size: JunctionBox['size'];
}

export const junctionBoxCatalog: JunctionBoxCatalogItem[] = [
    {
        label: 'Caja de pase 100×100×50',
        description: 'Para empalmes de alumbrado',
        icon: <Box size={13} />,
        size: '100x100x50',
    },
    {
        label: 'Caja de pase 100×55×50',
        description: 'Para tomacorrientes / interruptores',
        icon: <Box size={13} className="text-sky-400" />,
        size: '100x55x50',
    },
];

/* ─── Catálogo de ventanas ───────────────────────────────────────────────── */

export const windowCatalog: {
    label: string;
    material: string;
    icon: React.ReactNode;
    template: Partial<Window>;
}[] = [
    {
        label: 'Ventana Fija Rectangular',
        material: 'Aluminio',
        icon: <Maximize2 size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'rectangular',
            width: 1.2,
            height: 1.1,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Batiente',
        material: 'Aluminio',
        icon: <ArrowRight size={13} />,
        template: {
            windowType: 'casement',
            windowShape: 'rectangular',
            width: 1.0,
            height: 1.5,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Corrediza',
        material: 'Aluminio',
        icon: <Columns size={13} />,
        template: {
            windowType: 'sliding',
            windowShape: 'rectangular',
            width: 2.0,
            height: 1.2,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Corrediza c/Persiana',
        material: 'PVC',
        icon: <Columns size={13} />,
        template: {
            windowType: 'sliding',
            windowShape: 'rectangular',
            width: 1.5,
            height: 1.2,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Fija Cuadrada',
        material: 'Aluminio',
        icon: <Square size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'rectangular',
            width: 1.0,
            height: 1.0,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana de Baño',
        material: 'PVC',
        icon: <Maximize2 size={13} className="text-violet-400" />,
        template: {
            windowType: 'bathroom',
            windowShape: 'rectangular',
            width: 0.6,
            height: 0.4,
            sillHeight: 1.5,
        },
    },
    {
        label: 'Ojo de Buey',
        material: 'Aluminio',
        icon: <Circle size={13} />,
        template: {
            windowType: 'awning',
            windowShape: 'circular',
            width: 0.8,
            height: 0.8,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana de Arco',
        material: 'Madera',
        icon: <Frame size={13} />,
        template: {
            windowType: 'casement',
            windowShape: 'arched',
            width: 1.0,
            height: 1.5,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventanal Panorámico',
        material: 'Vidrio',
        icon: <Maximize2 size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'rectangular',
            width: 3.0,
            height: 2.5,
            sillHeight: 0.1,
        },
    },
    {
        label: 'Ventana Oscilante',
        material: 'PVC',
        icon: <ArrowRight size={13} />,
        template: {
            windowType: 'awning',
            windowShape: 'rectangular',
            width: 0.8,
            height: 0.5,
            sillHeight: 1.4,
        },
    },
    {
        label: 'Tragaluz / Claraboya',
        material: 'Vidrio',
        icon: <Circle size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'circular',
            width: 1.0,
            height: 1.0,
            sillHeight: 0.5,
        },
    },
];

/* ─── Catálogo de puertas ────────────────────────────────────────────────── */

export const doorCatalog: {
    label: string;
    icon: React.ReactNode;
    template: Partial<Door>;
}[] = [
    {
        label: 'Vano Abierto (Hueco)',
        icon: <Maximize2 size={13} />,
        template: {
            doorType: 'opening',
            width: 0.9,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Principal',
        icon: <ArrowRight size={13} />,
        template: {
            doorType: 'single',
            width: 0.9,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Doble',
        icon: <Columns size={13} />,
        template: {
            doorType: 'double',
            width: 1.8,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta de Baño',
        icon: <ArrowRight size={13} />,
        template: {
            doorType: 'single',
            width: 0.7,
            height: 2.0,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Corredera',
        icon: <Columns size={13} />,
        template: {
            doorType: 'sliding',
            width: 0.9,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Plegable',
        icon: <Minimize2 size={13} />,
        template: {
            doorType: 'folding',
            width: 0.8,
            height: 2.0,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta de Garaje',
        icon: <Columns size={13} />,
        template: {
            doorType: 'double',
            width: 2.5,
            height: 2.4,
            openingDirection: 'outward',
        },
    },
    {
        label: 'Puerta Contra Incendios',
        icon: <Shield size={13} />,
        template: {
            doorType: 'single',
            width: 0.9,
            height: 2.1,
            openingDirection: 'outward',
        },
    },
];

export const corridorCatalog: CorridorCatalogItem[] = [
    {
        label: 'Pasadizo solo techo',
        description: 'Losa superior / techo reflejado',
        icon: <Layers size={13} />,
        template: {
            type: 'roof_only',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Pasadizo normal',
        description: 'Techo y piso transitable',
        icon: <Layers size={13} />,
        template: { type: 'normal', slabThickness: 0.2, railingHeight: 1.05 },
    },
    {
        label: 'Pasadizo techo y piso',
        description: 'Losa completa entre niveles',
        icon: <LayoutGrid size={13} />,
        template: {
            type: 'roof_floor',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Pasadizo con baranda cemento',
        description: 'Piso, techo y parapeto sólido',
        icon: <Shield size={13} />,
        template: {
            type: 'concrete_railings',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Pasadizo con baranda metal',
        description: 'Piso, techo y barandas metálicas',
        icon: <Minimize2 size={13} />,
        template: {
            type: 'metal_railings',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Vereda (Piso sin barandas)',
        description: 'Piso a nivel de suelo, transitable',
        icon: <Layers size={13} />,
        template: {
            type: 'sidewalk',
            slabThickness: 0.2,
            railingHeight: 0,
        },
    },
    {
        label: 'Rampa',
        description: 'Superficie inclinada',
        icon: <LayoutGrid size={13} />,
        template: {
            type: 'ramp',
            slabThickness: 0.2,
            railingHeight: 1.05,
            rampSlope: 8,
            rampDirection: 'north',
        },
    },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export const isFixtureMatch = (a?: Partial<Fixture>, b?: Partial<Fixture>) => {
    if (a?.catalogSymbol && b?.catalogSymbol) return a.catalogSymbol === b.catalogSymbol;
    return a?.fixtureType === b?.fixtureType && a?.fixtureShape === b?.fixtureShape && a?.lumens === b?.lumens;
};

export const isWindowMatch = (a?: Partial<Window>, b?: Partial<Window>) =>
    a?.windowType === b?.windowType &&
    a?.windowShape === b?.windowShape &&
    a?.width === b?.width;

export const isDoorMatch = (a?: Partial<Door>, b?: Partial<Door>) =>
    a?.doorType === b?.doorType && a?.width === b?.width;

export const isCorridorMatch = (a?: CorridorConfig, b?: CorridorConfig) =>
    (a?.type ?? 'roof_only') === (b?.type ?? 'roof_only');

