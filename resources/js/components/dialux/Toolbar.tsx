/**
 * Toolbar.tsx  v2 — Engineering-grade DIALux sidebar toolbar
 *
 * Improvements:
 *  · Typography scaled to panel space (9 / 11 / 12 px hierarchy)
 *  · Engineering-precision visual language (tabular numbers, metric cards)
 *  · Normativa panel: EN 12464-1/2, IESNA RP series, NTP Peru — full profile view
 *  · Normativa affects: all rooms, import defaults, PDF export header
 *  · Better rail organisation: icons + 9 px labels, clear grouping
 *  · Consistent color tokens: cyan=tools, amber=measure/warn, emerald=normativa, red=delete
 *
 *  1. Types & Constants
 *  2. Normative data (EN / IESNA / NTP)
 *  3. Primitive UI
 *  4. FloatingPanelPortal
 *  5. Panel sub-components
 *  6. Panel bodies
 *  7. Main <Toolbar />
 */

import {
    MousePointer2, Square, Minus, Zap, Ruler, Hand, Grid, Layers,
    Trash2, Upload, AppWindow, Umbrella, Focus, RotateCcw, MinusCircle,
    Circle, Triangle, Move, PenTool, Spline, FilePlus, RotateCw, X,
    Wrench, Building2, Eye, FileInput, Lightbulb, DoorOpen, Search,
    Tag, Type, BookOpen, ChevronDown, CheckCircle2, AlertCircle,
    Gauge, Scale, Info,
} from 'lucide-react';
import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { NORMATIVE_LABELS, type NormativeStandard } from '@/hooks/dialux/roomLighting';
import {
    createScaleConfig, useEditorStore, useScaleConfig,
} from '@/hooks/dialux/useEditorStore';
import type { AngleSnapMode, DrawTool, IsoluxMode, ScaleConfig } from '@/hooks/dialux/useEditorStore';
import { useMlightcadEngine } from '@/hooks/dialux/useMlightcadEngine';
import { useWasmEngine } from '@/hooks/dialux/useWasmEngine';
import { getEffectiveScale } from './canvas/canvasUtils';
import { CatalogPanel } from './CatalogPanel';
import {
    LUMINAIRE_BRANDS, WINDOW_MATERIALS,
    type LuminaireBrand, type WindowMaterial,
} from './constants';
import { ImportLuminairesModal } from './ImportLuminairesModal';

/* ═══════════════════════════════════════════════════════════════════════════
   1. Types & Constants
═══════════════════════════════════════════════════════════════════════════ */

type PanelId =
    | 'herramientas'
    | 'construccion'
    | 'luz'
    | 'medir'
    | 'vista'
    | 'editar'
    | 'exportacion'
    | 'normativa'
    | null;

type PanelWidth = 'sm' | 'md' | 'lg' | 'xl';

const RAIL_PX = 56;

const WIDTH_CLASS: Record<PanelWidth, string> = {
    sm: 'w-52',
    md: 'w-64',
    lg: 'w-80',
    xl: 'w-96',
};

const ANGLE_SNAP_OPTIONS: Array<{ value: AngleSnapMode; label: string; hint: string }> = [
    { value: 'smart',      label: 'Inteligente', hint: 'Asistido + libre'   },
    { value: 'free',       label: 'Libre',       hint: 'Sin restricción'    },
    { value: 'orthogonal', label: 'Ortogonal',   hint: '0 · 90 · 180 · 270°' },
    { value: 'diagonal',   label: 'Diagonal',    hint: '30 · 45 · 60°'      },
    { value: 'fine',       label: 'Fino 15°',    hint: 'Cada 15° (24 ángulos)' },
];

const ISOLUX_MODES: Array<{ value: IsoluxMode; label: string }> = [
    { value: 'functional',  label: 'Funcional'    },
    { value: 'waves',       label: 'Ondas'        },
    { value: 'temperature', label: 'Temperatura'  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   2. Normative Data
   EN 12464-1:2011 (interior) · EN 12464-2:2014 (exterior)
   IESNA / IES RP-7 · IES RP-1 · IES RP-8
   NTP 370.050 / EM.010 RNE (Peru)
═══════════════════════════════════════════════════════════════════════════ */

export type NormKey = 'EN_12464_1' | 'EN_12464_2' | 'IESNA' | 'NTP_370';

export interface NormProfile {
    id: string;
    application: string;          // e.g. "5.3.1 Trabajos de despeje…"
    Em_work: number;              // lx — área de trabajo
    Em_surround?: number;         // lx — área circundante (= 1/3 Em_work if omitted)
    Em_background?: number;       // lx — área de fondo
    uniformity?: number;          // Emin / Em
    UGR?: number;                 // Unified Glare Rating (interior) or RG (exterior)
    Ra: number;                   // min CRI
    notes?: string;
}

interface NormSubsection {
    id: string;
    label: string;
    profiles: NormProfile[];
}

interface NormSection {
    id: string;
    label: string;
    subsections?: NormSubsection[];
    profiles?: NormProfile[];
}

interface NormStandardDef {
    key: NormKey;
    label: string;
    fullName: string;
    region: string;
    color: string;   // tailwind text-color class for badge
    sections: NormSection[];
}

// ─── EN 12464-1:2011 — Indoor Workplaces ────────────────────────────────────
const EN_12464_1: NormStandardDef = {
    key: 'EN_12464_1',
    label: 'EN 12464-1',
    fullName: 'EN 12464-1:2011 — Iluminación en puestos de trabajo interiores',
    region: 'Europa',
    color: 'text-cyan-300',
    sections: [
        {
            id: '4', label: '4 — Oficinas',
            profiles: [
                { id: '4.1', application: '4.1 Archivado y reproducción',                Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.40 },
                { id: '4.2', application: '4.2 Escritura, lectura, tratamiento de datos', Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '4.3', application: '4.3 Puestos CAD',                              Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '4.4', application: '4.4 Sala de reuniones / conferencias',         Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '4.5', application: '4.5 Mostrador de recepción',                   Em_work: 300, UGR: 22, Ra: 80, uniformity: 0.60 },
                { id: '4.6', application: '4.6 Centralita telefónica',                    Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '4.7', application: '4.7 Sala de espera',                           Em_work: 200, UGR: 22, Ra: 80, uniformity: 0.40 },
            ],
        },
        {
            id: '5', label: '5 — Centros educativos',
            profiles: [
                { id: '5.1', application: '5.1 Aulas de enseñanza',          Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '5.2', application: '5.2 Salas de dibujo técnico',      Em_work: 750, UGR: 16, Ra: 80, uniformity: 0.70 },
                { id: '5.3', application: '5.3 Laboratorios informáticos',    Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '5.4', application: '5.4 Laboratorios de ciencias',     Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '5.5', application: '5.5 Talleres de arte / cerámica',  Em_work: 500, UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: '5.6', application: '5.6 Salas de lectura / biblioteca',Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
            ],
        },
        {
            id: '7', label: '7 — Centros de salud',
            profiles: [
                { id: '7.1',  application: '7.1 Pasillos — día',             Em_work: 200,  UGR: 22, Ra: 80, uniformity: 0.40 },
                { id: '7.2',  application: '7.2 Pasillos — noche',           Em_work: 50,   UGR: 22, Ra: 80, uniformity: 0.40 },
                { id: '7.3',  application: '7.3 Habitaciones — general',      Em_work: 100,  UGR: 19, Ra: 80, uniformity: 0.40 },
                { id: '7.4',  application: '7.4 Habitaciones — examen',       Em_work: 300,  UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: '7.5',  application: '7.5 Quirófanos',                  Em_work: 1000, UGR: 19, Ra: 90, uniformity: 0.70 },
                { id: '7.6',  application: '7.6 Salas de urgencias',          Em_work: 500,  UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: '7.9',  application: '7.9 Laboratorios (análisis)',     Em_work: 500,  UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: '7.10', application: '7.10 Farmacias',                  Em_work: 500,  UGR: 19, Ra: 90, uniformity: 0.60 },
            ],
        },
        {
            id: '11', label: '11 — Industria / Fabricación',
            profiles: [
                { id: '11.1',  application: '11.1 Depósitos / almacenes — básico', Em_work: 100, UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: '11.2',  application: '11.2 Depósitos con lectura de etiq.', Em_work: 200, UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: '11.3',  application: '11.3 Empaquetado, embalaje',          Em_work: 300, UGR: 25, Ra: 60, uniformity: 0.60 },
                { id: '11.4',  application: '11.4 Inspección — grosera',           Em_work: 300, UGR: 22, Ra: 60, uniformity: 0.60 },
                { id: '11.5',  application: '11.5 Inspección — media',             Em_work: 500, UGR: 22, Ra: 80, uniformity: 0.60 },
                { id: '11.6',  application: '11.6 Inspección — fina',              Em_work: 1000,UGR: 19, Ra: 80, uniformity: 0.70 },
                { id: '11.7',  application: '11.7 Trabajo de precisión',           Em_work: 2000,UGR: 16, Ra: 90, uniformity: 0.70 },
                { id: '11.12', application: '11.12 Carpintería — grosera',         Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '11.13', application: '11.13 Carpintería — fina',            Em_work: 750, UGR: 16, Ra: 80, uniformity: 0.70 },
            ],
        },
        {
            id: '5c', label: '5c — Comercio / Ventas',
            profiles: [
                { id: '5c1', application: 'Zona de venta general',               Em_work: 300, UGR: 22, Ra: 80, uniformity: 0.40 },
                { id: '5c2', application: 'Área de caja / mostrador',            Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: '5c3', application: 'Zona de escaparate',                  Em_work: 1000,UGR: 19, Ra: 90, uniformity: 0.60 },
            ],
        },
    ],
};

// ─── EN 12464-2:2014 — Outdoor Workplaces ────────────────────────────────────
const EN_12464_2: NormStandardDef = {
    key: 'EN_12464_2',
    label: 'EN 12464-2',
    fullName: 'EN 12464-2:2014 — Iluminación en puestos de trabajo exteriores',
    region: 'Europa',
    color: 'text-cyan-300',
    sections: [
        {
            id: '4', label: '4 — Circulación y transportes',
            profiles: [
                { id: '4.1', application: '4.1 Circulación peatonal — básica',   Em_work: 5,   UGR: 55, Ra: 20, uniformity: 0.10 },
                { id: '4.2', application: '4.2 Circulación vehicular — básica',   Em_work: 10,  UGR: 55, Ra: 20, uniformity: 0.15 },
                { id: '4.3', application: '4.3 Escaleras exteriores',             Em_work: 50,  UGR: 55, Ra: 20, uniformity: 0.25 },
                { id: '4.4', application: '4.4 Zona de carga / descarga',         Em_work: 50,  UGR: 55, Ra: 40, uniformity: 0.25 },
            ],
        },
        {
            id: '5', label: '5 — Industria exterior',
            subsections: [
                {
                    id: '5.3', label: '5.3 Obras',
                    profiles: [
                        { id: '5.3.1', application: '5.3.1 Despeje, excavaciones y carga',             Em_work: 20,  Em_surround: 20,  Em_background: 6.7,  UGR: 55, Ra: 20, uniformity: 0.25 },
                        { id: '5.3.2', application: '5.3.2 Tendido de tuberías, trabajos auxiliares',   Em_work: 50,  Em_surround: 50,  Em_background: 16.7, UGR: 55, Ra: 20, uniformity: 0.25 },
                        { id: '5.3.3', application: '5.3.3 Montaje de elementos estructurales sencillo',Em_work: 100, Em_surround: 100, Em_background: 33,   UGR: 55, Ra: 20, uniformity: 0.40 },
                        { id: '5.3.4', application: '5.3.4 Montaje exigente y conexiones eléctricas',   Em_work: 200, Em_surround: 200, Em_background: 67,   UGR: 55, Ra: 40, uniformity: 0.40 },
                    ],
                },
                {
                    id: '5.5', label: '5.5 Explotaciones agrícolas',
                    profiles: [
                        { id: '5.5.1', application: '5.5.1 Trabajos agrícolas generales',   Em_work: 20,  UGR: 55, Ra: 20, uniformity: 0.10 },
                        { id: '5.5.2', application: '5.5.2 Clasificación y empaquetado',     Em_work: 50,  UGR: 55, Ra: 40, uniformity: 0.25 },
                        { id: '5.5.3', application: '5.5.3 Invernaderos — general',          Em_work: 100, UGR: 55, Ra: 40, uniformity: 0.40 },
                    ],
                },
                {
                    id: '5.6', label: '5.6 Gasolineras',
                    profiles: [
                        { id: '5.6.1', application: '5.6.1 Área de surtidores',              Em_work: 50,  UGR: 55, Ra: 40, uniformity: 0.25 },
                        { id: '5.6.2', application: '5.6.2 Zona de aparcamiento',            Em_work: 10,  UGR: 55, Ra: 20, uniformity: 0.15 },
                    ],
                },
                {
                    id: '5.7', label: '5.7 Industria y almacenes',
                    profiles: [
                        { id: '5.7.1', application: '5.7.1 Almacenamiento básico',           Em_work: 20,  UGR: 55, Ra: 20, uniformity: 0.10 },
                        { id: '5.7.2', application: '5.7.2 Almacenamiento regular',          Em_work: 50,  UGR: 55, Ra: 40, uniformity: 0.25 },
                        { id: '5.7.3', application: '5.7.3 Carga y descarga activa',         Em_work: 100, UGR: 55, Ra: 40, uniformity: 0.40 },
                        { id: '5.7.4', application: '5.7.4 Clasificación de materiales',     Em_work: 200, UGR: 55, Ra: 60, uniformity: 0.40 },
                    ],
                },
                {
                    id: '5.9', label: '5.9 Aparcamientos',
                    profiles: [
                        { id: '5.9.1', application: '5.9.1 Plazas de aparcamiento',         Em_work: 10,  UGR: 55, Ra: 20, uniformity: 0.15 },
                        { id: '5.9.2', application: '5.9.2 Rampas y accesos',               Em_work: 50,  UGR: 55, Ra: 20, uniformity: 0.25 },
                        { id: '5.9.3', application: '5.9.3 Zonas peatonales del parking',   Em_work: 20,  UGR: 55, Ra: 20, uniformity: 0.25 },
                    ],
                },
            ],
        },
        {
            id: '6', label: '6 — Deportes y ocio exterior',
            profiles: [
                { id: '6.1', application: '6.1 Campos de entrenamiento',      Em_work: 50,  UGR: 55, Ra: 20, uniformity: 0.25 },
                { id: '6.2', application: '6.2 Pistas recreativas',           Em_work: 100, UGR: 55, Ra: 60, uniformity: 0.40 },
                { id: '6.3', application: '6.3 Competición — sin TV',         Em_work: 200, UGR: 55, Ra: 65, uniformity: 0.60 },
                { id: '6.4', application: '6.4 Competición — TV color',       Em_work: 500, UGR: 55, Ra: 65, uniformity: 0.70 },
            ],
        },
    ],
};

// ─── IESNA (IES) Standards ────────────────────────────────────────────────────
const IESNA_STD: NormStandardDef = {
    key: 'IESNA',
    label: 'IESNA / IES',
    fullName: 'IES Lighting Handbook / RP Series — ANSI/IES Standards',
    region: 'EE.UU.',
    color: 'text-blue-300',
    sections: [
        {
            id: 'RP1', label: 'RP-1 — Oficinas',
            profiles: [
                { id: 'rp1-1',  application: 'RP-1: Archivado, fotocopiadoras',        Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.50 },
                { id: 'rp1-2',  application: 'RP-1: Escritura, lectura, PC',            Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'rp1-3',  application: 'RP-1: Sala de conferencias',              Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'rp1-4',  application: 'RP-1: Recepción / vestíbulo',             Em_work: 300, UGR: 22, Ra: 80, uniformity: 0.50 },
                { id: 'rp1-5',  application: 'RP-1: Sala de descanso',                  Em_work: 200, UGR: 22, Ra: 80, uniformity: 0.40 },
            ],
        },
        {
            id: 'RP7', label: 'RP-7 — Industria',
            profiles: [
                { id: 'rp7-1',  application: 'RP-7: Almacenamiento inactivo',           Em_work: 50,   UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: 'rp7-2',  application: 'RP-7: Almacenamiento activo',             Em_work: 100,  UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: 'rp7-3',  application: 'RP-7: Ensamblaje — grosero',              Em_work: 200,  UGR: 22, Ra: 60, uniformity: 0.50 },
                { id: 'rp7-4',  application: 'RP-7: Ensamblaje — medio',                Em_work: 500,  UGR: 22, Ra: 80, uniformity: 0.60 },
                { id: 'rp7-5',  application: 'RP-7: Ensamblaje — fino',                 Em_work: 1000, UGR: 19, Ra: 80, uniformity: 0.70 },
                { id: 'rp7-6',  application: 'RP-7: Ensamblaje — muy fino / precisión', Em_work: 2000, UGR: 16, Ra: 90, uniformity: 0.80 },
                { id: 'rp7-7',  application: 'RP-7: Inspección — grosera',              Em_work: 500,  UGR: 22, Ra: 80, uniformity: 0.60 },
                { id: 'rp7-8',  application: 'RP-7: Inspección — fina',                 Em_work: 1000, UGR: 19, Ra: 80, uniformity: 0.70 },
                { id: 'rp7-9',  application: 'RP-7: Zona de carga / dock',              Em_work: 100,  UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: 'rp7-10', application: 'RP-7: Control de calidad',                Em_work: 1000, UGR: 19, Ra: 90, uniformity: 0.70 },
            ],
        },
        {
            id: 'RP8', label: 'RP-8 — Vías públicas',
            profiles: [
                { id: 'rp8-1', application: 'RP-8: Vía residencial — clase R3',         Em_work: 10,  Ra: 40, uniformity: 0.30 },
                { id: 'rp8-2', application: 'RP-8: Colector comercial — clase A3',      Em_work: 20,  Ra: 40, uniformity: 0.30 },
                { id: 'rp8-3', application: 'RP-8: Arteria mayor — clase A2',           Em_work: 30,  Ra: 40, uniformity: 0.35 },
                { id: 'rp8-4', application: 'RP-8: Arteria de alta velocidad — A1',     Em_work: 50,  Ra: 40, uniformity: 0.40 },
            ],
        },
        {
            id: 'RP28', label: 'RP-28 — Estacionamientos',
            profiles: [
                { id: 'rp28-1', application: 'RP-28: Estacionamiento básico — noche',   Em_work: 10,  Ra: 40, uniformity: 0.20 },
                { id: 'rp28-2', application: 'RP-28: Estacionamiento cubierto',         Em_work: 50,  Ra: 40, uniformity: 0.25 },
                { id: 'rp28-3', application: 'RP-28: Rampa de acceso — día',            Em_work: 500, Ra: 60, uniformity: 0.40 },
                { id: 'rp28-4', application: 'RP-28: Rampa de acceso — noche',          Em_work: 50,  Ra: 60, uniformity: 0.40 },
            ],
        },
    ],
};

// ─── NTP 370.050 / EM.010 RNE (Peru) ─────────────────────────────────────────
const NTP_370: NormStandardDef = {
    key: 'NTP_370',
    label: 'NTP / EM.010',
    fullName: 'NTP 370.050 / EM.010 RNE — Reglamento Nacional de Edificaciones (Perú)',
    region: 'Perú',
    color: 'text-red-300',
    sections: [
        {
            id: 'em-1', label: 'Áreas administrativas y oficinas',
            profiles: [
                { id: 'em-1.1', application: 'Pasadizos y corredores interiores',     Em_work: 100, UGR: 28, Ra: 40, uniformity: 0.40 },
                { id: 'em-1.2', application: 'Escaleras y rampas',                    Em_work: 150, UGR: 22, Ra: 40, uniformity: 0.40 },
                { id: 'em-1.3', application: 'Oficinas — trabajos generales',         Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-1.4', application: 'Oficinas — trabajo con computadora',    Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-1.5', application: 'Sala de reuniones',                     Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-1.6', application: 'Sala de espera / recepción',            Em_work: 200, UGR: 22, Ra: 80, uniformity: 0.40 },
                { id: 'em-1.7', application: 'Archivo y depósito de documentos',      Em_work: 200, UGR: 25, Ra: 60, uniformity: 0.40 },
            ],
        },
        {
            id: 'em-2', label: 'Centros educativos',
            profiles: [
                { id: 'em-2.1', application: 'Aulas de enseñanza',                   Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-2.2', application: 'Laboratorios / talleres',               Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-2.3', application: 'Bibliotecas — salas de lectura',        Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-2.4', application: 'Sala de cómputo',                       Em_work: 300, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-2.5', application: 'Auditorios — presentaciones',           Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
            ],
        },
        {
            id: 'em-3', label: 'Establecimientos de salud',
            profiles: [
                { id: 'em-3.1', application: 'Consultorios y salas de examen',       Em_work: 500,  UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: 'em-3.2', application: 'Salas de hospitalización — general',   Em_work: 100,  UGR: 19, Ra: 80, uniformity: 0.40 },
                { id: 'em-3.3', application: 'Salas de hospitalización — lectura',   Em_work: 300,  UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-3.4', application: 'Salas de operaciones (SOP)',            Em_work: 1000, UGR: 16, Ra: 90, uniformity: 0.80 },
                { id: 'em-3.5', application: 'Laboratorios clínicos',                Em_work: 500,  UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: 'em-3.6', application: 'Farmacia',                             Em_work: 500,  UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: 'em-3.7', application: 'Corredores — período diurno',          Em_work: 200,  UGR: 22, Ra: 80, uniformity: 0.40 },
                { id: 'em-3.8', application: 'Corredores — período nocturno',        Em_work: 50,   UGR: 22, Ra: 80, uniformity: 0.40 },
            ],
        },
        {
            id: 'em-4', label: 'Industria',
            profiles: [
                { id: 'em-4.1', application: 'Almacenes y depósitos generales',      Em_work: 100, UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: 'em-4.2', application: 'Almacenes con lectura de etiquetas',   Em_work: 200, UGR: 25, Ra: 60, uniformity: 0.40 },
                { id: 'em-4.3', application: 'Industria ligera — trabajos medios',   Em_work: 300, UGR: 22, Ra: 80, uniformity: 0.60 },
                { id: 'em-4.4', application: 'Industria pesada — trabajos groseros', Em_work: 200, UGR: 25, Ra: 60, uniformity: 0.50 },
                { id: 'em-4.5', application: 'Control de calidad — inspección',      Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-4.6', application: 'Talleres mecánicos — trabajo fino',    Em_work: 750, UGR: 19, Ra: 80, uniformity: 0.70 },
            ],
        },
        {
            id: 'em-5', label: 'Comercio',
            profiles: [
                { id: 'em-5.1', application: 'Áreas de venta — supermercados',       Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-5.2', application: 'Áreas de venta — tiendas especializ.',  Em_work: 500, UGR: 19, Ra: 90, uniformity: 0.60 },
                { id: 'em-5.3', application: 'Cajas y mostradores',                  Em_work: 500, UGR: 19, Ra: 80, uniformity: 0.60 },
                { id: 'em-5.4', application: 'Escaparates y vitrinas',               Em_work: 1000,UGR: 19, Ra: 90, uniformity: 0.70 },
                { id: 'em-5.5', application: 'Estacionamiento cubierto',             Em_work: 75,  UGR: 25, Ra: 40, uniformity: 0.25 },
            ],
        },
        {
            id: 'em-6', label: 'Vías públicas exteriores',
            profiles: [
                { id: 'em-6.1', application: 'Vías peatonales y parques',            Em_work: 5,   Ra: 20, uniformity: 0.10 },
                { id: 'em-6.2', application: 'Vías residenciales',                   Em_work: 10,  Ra: 20, uniformity: 0.25 },
                { id: 'em-6.3', application: 'Vías colectoras',                      Em_work: 15,  Ra: 40, uniformity: 0.30 },
                { id: 'em-6.4', application: 'Avenidas y arterias',                  Em_work: 20,  Ra: 40, uniformity: 0.35 },
                { id: 'em-6.5', application: 'Intersecciones y cruces',              Em_work: 30,  Ra: 40, uniformity: 0.40 },
            ],
        },
    ],
};

export const ALL_STANDARDS: NormStandardDef[] = [EN_12464_1, EN_12464_2, IESNA_STD, NTP_370];

/** Helper: get Em_surround — if not provided, use 1/3 × Em_work (EN 12464-2 rule) */
const getSurround = (p: NormProfile): number =>
    p.Em_surround ?? Math.round((p.Em_work / 3) * 10) / 10;

/** Helper: get Em_background — if not provided, use 1/5 × Em_work */
const getBackground = (p: NormProfile): number =>
    p.Em_background ?? Math.round((p.Em_work / 5) * 10) / 10;

/* ═══════════════════════════════════════════════════════════════════════════
   3. Primitive UI
═══════════════════════════════════════════════════════════════════════════ */

const Sep = () => (
    <div className="mx-auto my-1.5 w-7 border-t border-gray-800/70" />
);

const PanelSep = ({ label }: { label?: string }) => (
    <div className="my-2 flex items-center gap-1.5 px-0.5">
        <div className="flex-1 border-t border-gray-700/40" />
        {label && (
            <span className="shrink-0 text-[9px] font-semibold tracking-[0.15em] text-gray-600 uppercase">
                {label}
            </span>
        )}
        <div className="flex-1 border-t border-gray-700/40" />
    </div>
);

/** Color-coded section header band, like DIALux */
const SectionBand = ({ label, icon }: { label: string; icon?: React.ReactNode }) => (
    <div className="flex items-center gap-1.5 rounded bg-gray-800/60 px-2 py-1.5 mb-1.5">
        {icon && <span className="text-gray-500 shrink-0">{icon}</span>}
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            {label}
        </span>
    </div>
);

/** Metric row: label left, monospaced value right */
const MetricRow = ({
    label, value, unit, highlight,
}: { label: string; value: React.ReactNode; unit?: string; highlight?: boolean }) => (
    <div className={`flex items-baseline justify-between px-1.5 py-[3px] rounded ${highlight ? 'bg-cyan-950/20' : ''}`}>
        <span className="text-[10px] text-gray-500 leading-tight">{label}</span>
        <span className={`font-mono text-[11px] leading-tight tabular-nums ${highlight ? 'text-cyan-300 font-semibold' : 'text-gray-200'}`}>
            {value}{unit && <span className="ml-0.5 text-[9px] text-gray-500">{unit}</span>}
        </span>
    </div>
);

interface ToolBtnProps {
    tool: DrawTool; icon: React.ReactNode; tip: string;
    active: DrawTool; onSet: (t: DrawTool) => void;
}
const ToolBtn: React.FC<ToolBtnProps> = ({ tool, icon, tip, active, onSet }) => (
    <button
        type="button"
        id={`dialux-tool-${tool}`}
        onClick={() => onSet(tool)}
        title={tip}
        className={`flex h-9 w-9 items-center justify-center rounded transition-all duration-100 ${
            active === tool
                ? 'bg-cyan-600/30 text-cyan-300 ring-1 ring-cyan-500/50'
                : 'text-gray-500 hover:bg-gray-700/50 hover:text-gray-200'
        }`}
    >
        {icon}
    </button>
);

interface GroupBtnProps {
    id: string; icon: React.ReactNode; label: string;
    isOpen: boolean; hasActive?: boolean; onClick: () => void;
    accentColor?: string;
}
const GroupBtn: React.FC<GroupBtnProps> = ({
    id, icon, label, isOpen, hasActive, onClick, accentColor = 'text-cyan-400',
}) => (
    <button
        type="button"
        id={id}
        onClick={onClick}
        title={label}
        className={`relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded transition-all duration-100 ${
            isOpen
                ? 'bg-gray-700/80 text-gray-100 ring-1 ring-gray-600/50 shadow-sm'
                : hasActive
                    ? `${accentColor} hover:bg-gray-700/40`
                    : 'text-gray-500 hover:bg-gray-700/40 hover:text-gray-300'
        }`}
    >
        <span className="text-[15px]">{icon}</span>
        <span className="text-[8.5px] leading-none font-semibold tracking-wider uppercase opacity-75">
            {label}
        </span>
        {isOpen && (
            <span className="absolute top-1/2 right-0 h-0 w-0 translate-x-full -translate-y-1/2
                border-y-[5px] border-l-[6px] border-y-transparent border-l-[#1a1d2e]" />
        )}
    </button>
);

interface PanelToolBtnProps extends ToolBtnProps { sublabel?: string }
const PanelToolBtn: React.FC<PanelToolBtnProps> = ({
    tool, icon, tip, sublabel, active, onSet,
}) => (
    <button
        type="button"
        id={`dialux-tool-${tool}`}
        onClick={() => onSet(tool)}
        title={tip}
        className={`flex h-9 w-full items-center gap-2.5 rounded px-2 text-left transition-all duration-100 ${
            active === tool
                ? 'bg-cyan-600/25 text-cyan-200 ring-1 ring-cyan-600/30'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
        }`}
    >
        <span className="shrink-0 text-gray-500">{icon}</span>
        <div className="min-w-0">
            <p className="truncate text-[11px] leading-snug">{tip.split(' (')[0]}</p>
            {sublabel && (
                <p className="text-[9.5px] leading-none text-gray-600 mt-0.5">{sublabel}</p>
            )}
        </div>
    </button>
);

interface PanelCadBtnProps {
    command: string; title: string; icon: React.ReactNode;
    onExecute: (cmd: string) => void; isReady: boolean; active?: boolean;
}
const PanelCadBtn: React.FC<PanelCadBtnProps> = ({
    command, title, icon, onExecute, isReady, active,
}) => {
    const [label, sublabel] = title.split(' - ');
    return (
        <button
            type="button"
            onClick={() => onExecute(command)}
            title={isReady ? title : `${title} (motor no listo)`}
            disabled={!isReady}
            className={`flex h-9 w-full items-center gap-2.5 rounded px-2 text-left transition-colors
                disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                    ? 'bg-cyan-900/30 text-cyan-300'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
            }`}
        >
            <span className="shrink-0 text-gray-500">{icon}</span>
            <div className="min-w-0">
                <p className="truncate text-[11px] leading-snug">{label}</p>
                {sublabel && (
                    <p className="truncate text-[9.5px] text-gray-600 mt-0.5">{sublabel}</p>
                )}
            </div>
        </button>
    );
};

interface PanelCardProps {
    title?: string; children: React.ReactNode;
    tone?: 'default' | 'accent' | 'warning' | 'normativa';
}
const PanelCard: React.FC<PanelCardProps> = ({ title, children, tone = 'default' }) => {
    const toneClass = {
        default:   'border-gray-700/40 bg-gray-900/40',
        accent:    'border-cyan-800/30 bg-cyan-950/10',
        warning:   'border-amber-700/30 bg-amber-950/10',
        normativa: 'border-emerald-800/30 bg-emerald-950/10',
    } satisfies Record<NonNullable<PanelCardProps['tone']>, string>;

    return (
        <div className={`rounded-md border p-2.5 ${toneClass[tone]}`}>
            {title && (
                <p className="mb-2 text-[9px] font-bold tracking-[0.15em] text-gray-500 uppercase">
                    {title}
                </p>
            )}
            {children}
        </div>
    );
};

function PanelTabs<T extends string>({
    tabs, activeTab, onChange,
}: { tabs: Array<{ id: T; label: string; count?: number }>; activeTab: T; onChange: (t: T) => void }) {
    return (
        <div className="mb-2.5 grid gap-1 rounded-md border border-gray-700/50 bg-[#12151f] p-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center justify-center gap-1 rounded px-1.5 py-1.5
                        text-[10px] font-semibold tracking-wide transition-colors ${
                        activeTab === tab.id
                            ? 'bg-cyan-700/40 text-cyan-100 ring-1 ring-cyan-600/40'
                            : 'text-gray-500 hover:bg-gray-800/70 hover:text-gray-200'
                    }`}
                >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                        <span className={`rounded px-1 text-[9px] ${
                            activeTab === tab.id
                                ? 'bg-cyan-950/70 text-cyan-300'
                                : 'bg-gray-800 text-gray-500'
                        }`}>{tab.count}</span>
                    )}
                </button>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. FloatingPanelPortal
═══════════════════════════════════════════════════════════════════════════ */

interface FloatingPanelPortalProps {
    title: string; icon: React.ReactNode;
    anchorRef: React.RefObject<HTMLElement | null>;
    onClose: () => void; children: React.ReactNode;
    width?: PanelWidth;
}

const FloatingPanelPortal: React.FC<FloatingPanelPortalProps> = ({
    title, icon, anchorRef, onClose, children, width = 'sm',
}) => {
    const [top, setTop] = useState(0);

    useEffect(() => {
        const update = () => {
            if (anchorRef.current)
                setTop(anchorRef.current.getBoundingClientRect().top);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [anchorRef]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const panel = document.getElementById('dialux-floating-panel');
            if (
                anchorRef.current &&
                !anchorRef.current.contains(target) &&
                panel && !panel.contains(target)
            ) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [anchorRef, onClose]);

    return createPortal(
        <div
            id="dialux-floating-panel"
            style={{ position: 'fixed', left: RAIL_PX + 5, top, zIndex: 9999,
                maxHeight: `calc(100vh - ${top + 10}px)` }}
            className={`${WIDTH_CLASS[width]} flex flex-col overflow-hidden rounded-lg
                border border-gray-700/60 bg-[#191c2c] shadow-2xl ring-1 ring-black/50`}
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-700/50
                bg-[#1e2236] px-3 py-2">
                <div className="flex items-center gap-2 text-gray-200">
                    <span className="text-gray-400">{icon}</span>
                    <span className="text-[11.5px] font-bold tracking-wide">{title}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-5 w-5 items-center justify-center rounded text-gray-500
                        transition-colors hover:bg-gray-600/40 hover:text-gray-300"
                >
                    <X size={10} />
                </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-2.5">
                <div className="flex flex-col gap-1">{children}</div>
            </div>
        </div>,
        document.body,
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. Panel sub-components
═══════════════════════════════════════════════════════════════════════════ */

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({
    value, onChange, placeholder = 'Buscar…',
}) => (
    <div className="relative mb-1.5">
        <Search size={11} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-600" />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-7.5 w-full rounded border border-gray-700/60 bg-gray-900/70 pr-7 pl-6
                text-[11px] text-gray-200 placeholder-gray-600 outline-none
                focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
        />
        {value && (
            <button type="button" onClick={() => onChange('')}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <X size={10} />
            </button>
        )}
    </div>
);

function ChipFilter<T extends string>({ options, active, onChange }: {
    options: readonly T[]; active: T; onChange: (v: T) => void;
}) {
    return (
        <div className="mb-1.5 flex flex-wrap gap-1">
            {options.map((opt) => (
                <button key={opt} type="button" onClick={() => onChange(opt)}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px]
                        font-medium transition-colors ${
                        active === opt
                            ? 'bg-cyan-700/60 text-cyan-100 ring-1 ring-cyan-500/40'
                            : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700/60 hover:text-gray-300'
                    }`}
                >
                    <Tag size={8} />
                    {opt}
                </button>
            ))}
        </div>
    );
}

const AngleSnapBlock: React.FC<{ mode: AngleSnapMode; onChange: (v: AngleSnapMode) => void }> = ({
    mode, onChange,
}) => (
    <div className="rounded-md border border-gray-700/40 bg-gray-900/40 p-2">
        <p className="px-1 pb-1.5 text-[9px] font-bold tracking-[0.15em] text-gray-600 uppercase">
            Modo angular
        </p>
        {ANGLE_SNAP_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
                className={`mt-0.5 flex w-full items-center rounded px-2 py-1.5 text-left transition-colors ${
                    mode === opt.value
                        ? 'bg-cyan-900/30 text-cyan-300'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                }`}
            >
                <span className="text-[11px]">{opt.label}</span>
                <span className="ml-auto text-[9.5px] text-gray-500 font-mono">{opt.hint}</span>
            </button>
        ))}
        <p className="mt-1.5 px-1 text-[9.5px] leading-snug text-gray-600">
            Mayús fuerza ortogonal temporal en cualquier modo.
        </p>
    </div>
);

const IsoluxBlock: React.FC<{ mode: IsoluxMode; onChange: (v: IsoluxMode) => void }> = ({
    mode, onChange,
}) => (
    <div className="rounded-md border border-gray-700/40 bg-gray-900/40 p-2">
        <p className="px-1 pb-1.5 text-[9px] font-bold tracking-[0.15em] text-gray-600 uppercase">
            Modo Isolux
        </p>
        {ISOLUX_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => onChange(m.value)}
                className={`mt-0.5 flex h-8 w-full items-center rounded px-2 text-left
                    text-[11px] transition-colors ${
                    mode === m.value
                        ? 'bg-cyan-900/30 text-cyan-300'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                }`}
            >
                {m.label}
                {mode === m.value && (
                    <span className="ml-auto rounded bg-cyan-950/70 px-1.5 py-0.5 text-[9px] text-cyan-300">
                        Activo
                    </span>
                )}
            </button>
        ))}
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   6. Panel Bodies
═══════════════════════════════════════════════════════════════════════════ */

/* ── Normativa Panel ──────────────────────────────────────────────────────── */
interface NormativaPanelProps {
    defaultNormativeStandard: NormativeStandard;
    onDefaultNormativeStandardChange: (v: NormativeStandard) => void;
    onApplyStandardToAllRooms: () => void;
}

const NormativaPanel: React.FC<NormativaPanelProps> = ({
    defaultNormativeStandard,
    onDefaultNormativeStandardChange,
    onApplyStandardToAllRooms,
}) => {
    const [selectedKey, setSelectedKey] = useState<NormKey>('EN_12464_2');
    const [selectedSectionId, setSelectedSectionId] = useState<string>('5');
    const [selectedSubId, setSelectedSubId] = useState<string>('5.3');
    const [selectedProfileId, setSelectedProfileId] = useState<string>('5.3.1');
    const [applied, setApplied] = useState(false);

    const std = ALL_STANDARDS.find((s) => s.key === selectedKey)!;
    const section = std.sections.find((s) => s.id === selectedSectionId);
    const subsection = section?.subsections?.find((s) => s.id === selectedSubId);
    const profiles: NormProfile[] = subsection?.profiles ?? section?.profiles ?? [];
    const profile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0];

    // Reset selections when standard changes
    const handleStdChange = (key: NormKey) => {
        const newStd = ALL_STANDARDS.find((s) => s.key === key)!;
        const sec = newStd.sections[0];
        setSelectedKey(key);
        setSelectedSectionId(sec.id);
        const sub = sec.subsections?.[0];
        setSelectedSubId(sub?.id ?? '');
        const prof = sub?.profiles[0] ?? sec.profiles?.[0];
        setSelectedProfileId(prof?.id ?? '');
        setApplied(false);
    };

    const handleSectionChange = (id: string) => {
        setSelectedSectionId(id);
        const sec = std.sections.find((s) => s.id === id);
        const sub = sec?.subsections?.[0];
        setSelectedSubId(sub?.id ?? '');
        const prof = sub?.profiles[0] ?? sec?.profiles?.[0];
        setSelectedProfileId(prof?.id ?? '');
        setApplied(false);
    };

    const handleApply = () => {
        onApplyStandardToAllRooms();
        setApplied(true);
        setTimeout(() => setApplied(false), 2500);
    };

    return (
        <div className="flex flex-col gap-2.5">
            {/* Standard selector */}
            <PanelCard title="Estándar normativo" tone="normativa">
                <div className="flex flex-col gap-1.5">
                    {ALL_STANDARDS.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => handleStdChange(s.key)}
                            className={`flex items-start gap-2 rounded px-2.5 py-2 text-left transition-colors ${
                                selectedKey === s.key
                                    ? 'bg-emerald-900/25 ring-1 ring-emerald-700/40'
                                    : 'hover:bg-gray-700/40'
                            }`}
                        >
                            <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                selectedKey === s.key ? 'bg-emerald-400' : 'bg-gray-600'
                            }`} />
                            <div>
                                <p className={`text-[11px] font-semibold ${
                                    selectedKey === s.key ? 'text-emerald-300' : 'text-gray-300'
                                }`}>{s.label}</p>
                                <p className="text-[9.5px] text-gray-500 leading-snug">{s.region}</p>
                            </div>
                            {selectedKey === s.key && (
                                <CheckCircle2 size={12} className="ml-auto shrink-0 mt-0.5 text-emerald-400" />
                            )}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-[9.5px] text-gray-600 leading-snug px-1">
                    {std.fullName}
                </p>
            </PanelCard>

            {/* Section → Subsection → Profile selectors */}
            <PanelCard title="Selección de perfil">
                {/* Section */}
                <label className="mb-1 block text-[9px] text-gray-600 uppercase tracking-wider">
                    Sección / área
                </label>
                <select
                    value={selectedSectionId}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                        text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500/40 mb-2"
                >
                    {std.sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>{sec.label}</option>
                    ))}
                </select>

                {/* Subsection (if any) */}
                {section?.subsections && section.subsections.length > 0 && (
                    <>
                        <label className="mb-1 block text-[9px] text-gray-600 uppercase tracking-wider">
                            Subsección
                        </label>
                        <select
                            value={selectedSubId}
                            onChange={(e) => {
                                setSelectedSubId(e.target.value);
                                const sub = section.subsections!.find((s) => s.id === e.target.value);
                                setSelectedProfileId(sub?.profiles[0]?.id ?? '');
                                setApplied(false);
                            }}
                            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                                text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500/40 mb-2"
                        >
                            {section.subsections.map((sub) => (
                                <option key={sub.id} value={sub.id}>{sub.label}</option>
                            ))}
                        </select>
                    </>
                )}

                {/* Application / Profile */}
                <label className="mb-1 block text-[9px] text-gray-600 uppercase tracking-wider">
                    Aplicación
                </label>
                <select
                    value={selectedProfileId}
                    onChange={(e) => { setSelectedProfileId(e.target.value); setApplied(false); }}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                        text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                    {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.application}</option>
                    ))}
                </select>
            </PanelCard>

            {/* Active profile details — DIALux-style metrics card */}
            {profile && (
                <div className="rounded-md border border-emerald-800/40 bg-emerald-950/15">
                    <SectionBand label="Perfil activo" icon={<Gauge size={11} />} />

                    <div className="px-2 pb-2 flex flex-col gap-0.5">
                        <SectionBand label="Intensidad lumínica" />
                        <MetricRow label="Área de trabajo (Em)"     value={profile.Em_work}         unit="lx" highlight />
                        <MetricRow label="Área circundante (Em)"    value={getSurround(profile)}    unit="lx" />
                        <MetricRow label="Área de fondo (Em)"       value={getBackground(profile)}  unit="lx" />
                        {profile.uniformity !== undefined && (
                            <MetricRow label="Uniformidad (Emin/Em)" value={profile.uniformity.toFixed(2)} />
                        )}

                        {profile.UGR !== undefined && (
                            <>
                                <SectionBand label="Deslumbramiento" />
                                <MetricRow label={selectedKey.startsWith('EN') && selectedKey === 'EN_12464_2' ? 'Al aire libre (RG)' : 'UGR límite'}
                                    value={`≤ ${profile.UGR}`} />
                            </>
                        )}

                        <SectionBand label="Calidad de color" />
                        <MetricRow label="Índice reproducción (Ra)"  value={`≥ ${profile.Ra}`} />

                        {profile.notes && (
                            <div className="mt-1.5 flex gap-1.5 rounded bg-amber-950/20 px-2 py-1.5 text-[9.5px] text-amber-300/80">
                                <Info size={11} className="shrink-0 mt-0.5" />
                                <span>{profile.notes}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Reference normative (for store + export) */}
            <PanelCard title="Normativa de referencia (exportación)" tone="accent">
                <p className="mb-1.5 text-[9.5px] text-gray-500 leading-snug">
                    Estándar que se incluirá en encabezados de reportes PDF y se aplicará
                    como defecto en nuevos recintos.
                </p>
                <select
                    value={defaultNormativeStandard}
                    onChange={(e) => onDefaultNormativeStandardChange(e.target.value as NormativeStandard)}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                        text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500/40 mb-2"
                >
                    {Object.entries(NORMATIVE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={handleApply}
                    className={`flex w-full items-center justify-center gap-2 rounded py-2 text-[11px]
                        font-semibold transition-all duration-200 ${
                        applied
                            ? 'bg-emerald-700/40 text-emerald-300 ring-1 ring-emerald-600/40'
                            : 'bg-emerald-800/30 text-emerald-200 hover:bg-emerald-700/40 ring-1 ring-emerald-800/40'
                    }`}
                >
                    {applied
                        ? <><CheckCircle2 size={13} /> Aplicado a todos los recintos</>
                        : <><Scale size={13} /> Aplicar a todos los recintos</>
                    }
                </button>
                <p className="mt-2 text-[9px] text-gray-600 leading-snug text-center">
                    Afecta importación DXF, exportación PDF y cálculos de cumplimiento.
                </p>
            </PanelCard>
        </div>
    );
};

/* ── Herramientas CAD Panel ───────────────────────────────────────────────── */
const HerramientasPanel: React.FC<{ onExecute: (cmd: string) => void; isReady: boolean }> = ({
    onExecute, isReady,
}) => {
    const CMDS = [
        { cmd: 'line',      label: 'Línea',          sublabel: 'Rectas',               icon: <MinusCircle size={13} /> },
        { cmd: 'pline',     label: 'Polilínea',      sublabel: 'Continua conectada',   icon: <PenTool size={13} /> },
        { cmd: 'rectangle', label: 'Rectángulo',     sublabel: 'Forma cerrada',        icon: <Square size={13} /> },
        { cmd: 'circle',    label: 'Círculo',        sublabel: 'Centro + radio',       icon: <Circle size={13} /> },
        { cmd: 'arc',       label: 'Arco',           sublabel: '3 puntos o ángulo',    icon: <Triangle size={13} /> },
        { cmd: 'spline',    label: 'Curva spline',   sublabel: 'Curva suave',          icon: <Spline size={13} /> },
        { cmd: 'text',      label: 'Texto simple',   sublabel: 'Una línea',            icon: <Type size={13} /> },
        { cmd: 'mtext',     label: 'Texto múltiple', sublabel: 'Bloque multilínea',    icon: <FilePlus size={13} /> },
    ];
    return (
        <>
            <SectionBand label="Entidades CAD" icon={<Wrench size={11} />} />
            {CMDS.map(({ cmd, label, sublabel, icon }) => (
                <PanelCadBtn
                    key={cmd}
                    command={cmd}
                    title={`${label} - ${sublabel}`}
                    icon={icon}
                    onExecute={onExecute}
                    isReady={isReady}
                />
            ))}
        </>
    );
};

/* ── Construccion Panel ───────────────────────────────────────────────────── */
const ConstruccionPanel: React.FC<{
    activeTool: DrawTool; onSetTool: (t: DrawTool) => void;
    angleSnapMode: AngleSnapMode; onSetAngleSnap: (v: AngleSnapMode) => void;
}> = ({ activeTool, onSetTool, angleSnapMode, onSetAngleSnap }) => {
    const [search, setSearch] = useState('');
    const [material, setMaterial] = useState<WindowMaterial>('Todos');
    const [activeTab, setActiveTab] = useState<'tools' | 'catalog'>('tools');

    const TOOL_GROUPS: Array<{
        label: string;
        tools: Array<{ tool: DrawTool; icon: React.ReactNode; tip: string; sublabel?: string }>;
    }> = [
        {
            label: 'Espacios',
            tools: [
                { tool: 'room',     icon: <Square size={13} />,   tip: 'Recinto poligonal (R)',  sublabel: 'Polígono del recinto'    },
                { tool: 'corridor', icon: <Layers size={13} />,   tip: 'Pasadizo',               sublabel: 'Polígono techo reflejado' },
                { tool: 'stair',    icon: <Triangle size={13} />, tip: 'Escalera (E)',            sublabel: 'Caja de escalera'        },
            ],
        },
        {
            label: 'Muros',
            tools: [
                { tool: 'wall',     icon: <Minus size={13} />,    tip: 'Pared (W)',              sublabel: 'Polilínea de pared'      },
                { tool: 'education-wall', icon: <Building2 size={13} />, tip: 'Muro colegio',    sublabel: 'Ingresos y salidas'     },
            ],
        },
        {
            label: 'Aberturas y cubierta',
            tools: [
                { tool: 'window',   icon: <AppWindow size={13} />,tip: 'Ventana (N)',            sublabel: 'En pared existente'      },
                { tool: 'door',     icon: <DoorOpen size={13} />, tip: 'Puerta (D)',             sublabel: 'Entrada / salida'        },
                { tool: 'canopy',   icon: <Umbrella size={13} />, tip: 'Voladizo (C)',           sublabel: 'Protección solar'        },
            ],
        },
    ];
    const toolCount = TOOL_GROUPS.reduce((total, group) => total + group.tools.length, 0);

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'tools',   label: 'Dibujo',    count: toolCount },
                    { id: 'catalog', label: 'Catálogo' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'tools' ? (
                <>
                    <PanelCard tone="accent">
                        <div className="space-y-2">
                            {TOOL_GROUPS.map((group) => (
                                <div key={group.label}>
                                    <p className="mb-1 px-1 text-[9px] font-semibold tracking-[0.14em] text-gray-600 uppercase">
                                        {group.label}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {group.tools.map((t) => (
                                            <PanelToolBtn key={t.tool} {...t} active={activeTool} onSet={onSetTool} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                    <PanelSep label="Ayuda de dibujo" />
                    <AngleSnapBlock mode={angleSnapMode} onChange={onSetAngleSnap} />
                    <PanelCard title="Flujo recomendado">
                        <ol className="space-y-1.5 text-[10px] leading-relaxed text-gray-400 list-none">
                            {['Dibuja recinto o muros.',
                              'Inserta ventanas, puertas y voladizos.',
                              'Importa plano DXF solo si necesitas referencia.']
                              .map((t, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="shrink-0 font-mono text-cyan-700">{i + 1}.</span>
                                    {t}
                                </li>
                            ))}
                        </ol>
                    </PanelCard>
                </>
            ) : (
                <>
                    <PanelCard title="Filtros">
                        <ChipFilter options={WINDOW_MATERIALS} active={material} onChange={setMaterial} />
                        <SearchInput value={search} onChange={setSearch} placeholder="Buscar ventana o puerta…" />
                    </PanelCard>
                    <PanelCard title="Objetos arquitectónicos">
                        <div className="max-h-[50vh] overflow-y-auto pr-0.5">
                            <CatalogPanel
                                filterCategory="architecture"
                                filterMaterial={material !== 'Todos' ? material : undefined}
                                search={search}
                            />
                        </div>
                    </PanelCard>
                </>
            )}
        </>
    );
};

/* ── Luz Panel ────────────────────────────────────────────────────────────── */
const LuzPanel: React.FC<{
    activeTool: DrawTool; onSetTool: (t: DrawTool) => void;
    gridRows: number; gridCols: number;
    onSetRows: (n: number) => void; onSetCols: (n: number) => void;
    onOpenImportModal?: () => void;
}> = ({ activeTool, onSetTool, gridRows, gridCols, onSetRows, onSetCols, onOpenImportModal }) => {
    const [brand, setBrand] = useState<LuminaireBrand>('Todas');
    const [activeTab, setActiveTab] = useState<'insert' | 'catalog'>('insert');

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'insert',  label: 'Inserción' },
                    { id: 'catalog', label: 'Catálogo'  },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
            {activeTab === 'insert' ? (
                <>
                    <PanelCard title="Herramientas de luz" tone="accent">
                        <div className="grid grid-cols-2 gap-1">
                            <PanelToolBtn tool="fixture"      icon={<Zap size={13} />}  active={activeTool} onSet={onSetTool} tip="Luminaria (F)"       sublabel="Colocar unitaria" />
                            <PanelToolBtn tool="fixture-grid" icon={<Grid size={13} />} active={activeTool} onSet={onSetTool} tip="Grilla de focos (G)" sublabel="Distribución N×M" />
                        </div>
                    </PanelCard>
                    <PanelSep label="Config. de grilla" />
                    <PanelCard>
                        <div className="flex gap-2 mb-2">
                            {[{ label: 'Filas', value: gridRows, set: onSetRows },
                              { label: 'Cols',  value: gridCols, set: onSetCols }].map(({ label, value, set }) => (
                                <div key={label} className="flex-1">
                                    <label className="mb-1 block text-[9px] text-gray-600 uppercase tracking-wider">
                                        {label}
                                    </label>
                                    <input
                                        type="number" min={1} max={20} value={value}
                                        onChange={(e) => set(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                                            text-[11px] font-mono text-gray-200 outline-none focus:ring-1 focus:ring-amber-500/50"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between rounded border border-amber-700/20
                            bg-amber-950/10 px-2 py-1.5 text-[10.5px] text-gray-300">
                            <span>Total unidades</span>
                            <span className="font-mono font-bold text-amber-300">{gridRows * gridCols} uds</span>
                        </div>
                    </PanelCard>
                </>
            ) : (
                <>
                    <PanelCard title="Catálogo de luminarias">
                        <p className="mb-2.5 text-[10px] text-gray-400 leading-relaxed">
                            Busca y selecciona luminarias del catálogo completo.
                        </p>
                        <Button className="w-full justify-center gap-2 bg-cyan-700/80 text-cyan-100 hover:bg-cyan-600/80"
                            onClick={onOpenImportModal}>
                            <Lightbulb size={13} />
                            <span className="text-[11px]">Abrir catálogo</span>
                        </Button>
                    </PanelCard>
                    <PanelCard title="Filtros por marca">
                        <ChipFilter options={LUMINAIRE_BRANDS} active={brand} onChange={setBrand} />
                    </PanelCard>
                </>
            )}
        </>
    );
};

/* ── Medir Panel ─────────────────────────────────────────────────────────── */
const MedirPanel: React.FC<{
    activeTool: DrawTool; onSetTool: (t: DrawTool) => void;
    onExecute: (cmd: string) => void; isReady: boolean;
}> = ({ activeTool, onSetTool, onExecute, isReady }) => (
    <>
        <SectionBand label="Medición" icon={<Ruler size={11} />} />
        <PanelToolBtn tool="measure" icon={<Ruler size={13} />} active={activeTool}
            onSet={onSetTool} tip="Medir distancia (M)" sublabel="Entre dos puntos" />
        <PanelCadBtn command="measurearea"  title="Medir área"     icon={<Square size={13} />}  onExecute={onExecute} isReady={isReady} />
        <PanelCadBtn command="measureangle" title="Medir ángulo"   icon={<RotateCw size={13} />} onExecute={onExecute} isReady={isReady} />
        <PanelSep />
        <PanelCadBtn command="clearmeasurements" title="Limpiar mediciones"
            icon={<Trash2 size={13} />} onExecute={onExecute} isReady={isReady} />
    </>
);

/* ── Vista Panel ─────────────────────────────────────────────────────────── */
const VistaPanel: React.FC<{
    showIsolux: boolean; isoluxMode: IsoluxMode; isReady: boolean;
    onExecute: (cmd: string) => void; onToggleIsolux: () => void;
    onSetIsoluxMode: (m: IsoluxMode) => void; onResetView: () => void;
}> = ({ showIsolux, isoluxMode, isReady, onExecute, onToggleIsolux, onSetIsoluxMode, onResetView }) => (
    <>
        <SectionBand label="Navegación" icon={<Eye size={11} />} />
        <PanelCadBtn command="zoom" title="Zoom extents - Ajustar vista" icon={<Focus size={13} />} onExecute={onExecute} isReady={isReady} />
        <PanelCadBtn command="pan"  title="Pan CAD - Mover vista"       icon={<Move size={13} />}  onExecute={onExecute} isReady={isReady} />
        <PanelSep label="Superposiciones" />
        <button type="button" disabled title="Grilla nativa no soportada"
            className="flex h-9 w-full cursor-not-allowed items-center gap-2.5 rounded bg-gray-800/60 px-2 text-gray-500">
            <Grid size={13} />
            <span className="text-[11px]">Grilla</span>
            <span className="ml-auto rounded bg-gray-700/50 px-1.5 py-0.5 text-[9px] text-gray-400">N/D</span>
        </button>
        <button type="button" id="dialux-toggle-isolux" onClick={onToggleIsolux}
            className={`flex h-9 w-full items-center gap-2.5 rounded px-2 text-left transition-colors ${
                showIsolux ? 'bg-yellow-900/20 text-yellow-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
            }`}
        >
            <Layers size={13} />
            <span className="text-[11px]">Isolux</span>
            <span className={`ml-auto rounded px-1.5 py-0.5 text-[9px] ${
                showIsolux ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-700/50 text-gray-600'
            }`}>{showIsolux ? 'ON' : 'OFF'}</span>
        </button>
        <IsoluxBlock mode={isoluxMode} onChange={onSetIsoluxMode} />
        <PanelSep />
        <button type="button" id="dialux-reset-view" onClick={onResetView}
            className="flex h-9 w-full items-center gap-2.5 rounded px-2 text-left
                text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-100">
            <RotateCcw size={13} />
            <span className="text-[11px]">Resetear vista</span>
        </button>
    </>
);

/* ── Exportación Panel ───────────────────────────────────────────────────── */
const ExportacionPanel: React.FC<{
    hasCadDoc: boolean; isLoading: boolean; fileName?: string;
    activeTool: DrawTool; scaleConfig: ScaleConfig | null;
    detectedScale: ScaleConfig | null; scaleConfirmed: boolean;
    onNewDoc: () => void; onImportClick: () => void;
    onApplyScale: (cfg: ScaleConfig) => Promise<void>; onCalibrate: () => void;
    onResetCalibration: () => void;
    defaultNormativeStandard: NormativeStandard;
    onDefaultNormativeStandardChange: (v: NormativeStandard) => void;
    onApplyStandardToAllRooms: () => void;
}> = ({
    hasCadDoc, isLoading, fileName, activeTool, scaleConfig,
    detectedScale, scaleConfirmed, onNewDoc, onImportClick, onApplyScale,
    onCalibrate, onResetCalibration,
    defaultNormativeStandard, onDefaultNormativeStandardChange, onApplyStandardToAllRooms,
}) => (
    <div className="flex flex-col gap-2.5">
        <PanelCard title="Documento CAD" tone="accent">
            <Button variant="outline"
                className="w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40 mb-2"
                onClick={onNewDoc} disabled={isLoading}>
                <FilePlus size={13} /><span className="text-[11px]">Nuevo documento</span>
            </Button>
            <div className="rounded border border-gray-700/40 bg-gray-900/40 px-2 py-1.5 text-[10.5px]">
                <span className="text-gray-500">Estado: </span>
                <span className="font-mono text-cyan-300">
                    {hasCadDoc ? (fileName ?? 'Documento activo') : 'Sin documento'}
                </span>
            </div>
        </PanelCard>

        <PanelCard title="Importar plano" tone="accent">
            <Button variant="outline"
                className="w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40 mb-2"
                onClick={onImportClick}>
                <Upload size={13} /><span className="text-[11px]">Importar DXF / DWG</span>
            </Button>
        </PanelCard>

        <PanelCard title="Escala y calibración">
            <div className="flex items-center justify-between rounded border border-gray-700/40 bg-gray-900/40 px-2 py-1.5 mb-2">
                <span className="text-[10px] text-gray-500">Escala actual</span>
                <span className="font-mono text-[11px] text-cyan-300">{scaleConfig?.displayUnit ?? '—'}</span>
            </div>
            {detectedScale && !scaleConfirmed && (
                <button type="button" onClick={() => void onApplyScale(detectedScale)}
                    className="mb-2 w-full rounded bg-amber-700/70 px-2 py-1.5 text-[10.5px]
                        font-semibold text-amber-50 transition-colors hover:bg-amber-600">
                    ⚡ Confirmar escala detectada: {detectedScale.displayUnit}
                </button>
            )}
            <div className="grid grid-cols-2 gap-1">
                <Button variant="outline" size="sm"
                    className={`justify-center gap-1 border-gray-700 bg-gray-800/40 text-[10.5px] text-gray-200 hover:bg-gray-700/60 ${
                        activeTool === 'calibrate' ? 'border-amber-600/60 bg-amber-900/30 text-amber-200' : ''}`}
                    onClick={onCalibrate}>
                    <Ruler size={11} />Calibrar
                </Button>
                <Button variant="outline" size="sm"
                    className="justify-center gap-1 border-gray-700 bg-gray-800/40 text-[10.5px] text-gray-200 hover:bg-gray-700/60"
                    onClick={onResetCalibration}>
                    <RotateCcw size={11} />Reset
                </Button>
            </div>
        </PanelCard>

        <PanelCard title="Normativa de referencia">
            <select
                value={defaultNormativeStandard}
                onChange={(e) => onDefaultNormativeStandardChange(e.target.value as NormativeStandard)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                    text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500/40 mb-2"
            >
                {Object.entries(NORMATIVE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                ))}
            </select>
            <Button variant="outline" size="sm"
                className="w-full justify-center gap-2 border-emerald-800/40 bg-emerald-950/20 text-emerald-200 hover:bg-emerald-900/40"
                onClick={onApplyStandardToAllRooms}>
                <Scale size={11} /><span className="text-[10.5px]">Aplicar a todos los recintos</span>
            </Button>
        </PanelCard>

        <PanelCard title="Exportar reporte">
            <Button variant="outline"
                className="w-full justify-start gap-2 border-gray-700 bg-gray-800/40 text-gray-200 hover:bg-gray-700/60"
                onClick={() => document.getElementById('dialux-btn-export-pdf')?.click()}>
                <FileInput size={13} /><span className="text-[11px]">Exportar Reporte PDF</span>
            </Button>
        </PanelCard>
    </div>
);

/* ── Editar Panel ────────────────────────────────────────────────────────── */
const EditarPanel: React.FC<{
    onExecute: (cmd: string) => void; isReady: boolean; onDeleteSelected: () => void;
}> = ({ onExecute, isReady, onDeleteSelected }) => (
    <>
        <SectionBand label="Edición" icon={<Wrench size={11} />} />
        <PanelCadBtn command="erase" title="Borrar - Objetos seleccionados"
            icon={<Trash2 size={13} />} onExecute={onExecute} isReady={isReady} />
        <button type="button" id="dialux-delete-selected" onClick={onDeleteSelected}
            className="flex h-9 w-full items-center gap-2.5 rounded px-2 text-left
                text-red-500/70 transition-colors hover:bg-red-900/20 hover:text-red-400">
            <X size={13} />
            <span className="text-[11px]">Eliminar seleccionado</span>
        </button>
    </>
);

/* ═══════════════════════════════════════════════════════════════════════════
   7. Main Toolbar
═══════════════════════════════════════════════════════════════════════════ */

export const Toolbar: React.FC = () => {
    const store = useEditorStore();
    const wasmEngine = useWasmEngine();
    const engine = useMlightcadEngine();
    const scaleConfig = useScaleConfig();

    const { activeTool, angleSnapMode, showGrid, showIsolux, isoluxMode } = store.ui;
    const { isParsing, parseDxf } = wasmEngine;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [openPanel, setOpenPanel] = useState<PanelId>(null);
    const [lastCmd, setLastCmd] = useState<string | null>(null);
    const [detectedScale, setDetectedScale] = useState<ScaleConfig | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [scaleConfirmed, setScaleConfirmed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportLuminairesModalOpen, setIsImportLuminairesModalOpen] = useState(false);

    const defaultNormativeStandard = useEditorStore((s) => s.defaultRoomNormativeStandard);
    const setDefaultNormativeStandard = useEditorStore((s) => s.setDefaultRoomNormativeStandard);

    /* Anchor refs */
    const herramientasRef = useRef<HTMLDivElement>(null);
    const construccionRef = useRef<HTMLDivElement>(null);
    const luzRef           = useRef<HTMLDivElement>(null);
    const medirRef         = useRef<HTMLDivElement>(null);
    const vistaRef         = useRef<HTMLDivElement>(null);
    const exportacionRef   = useRef<HTMLDivElement>(null);
    const editarRef        = useRef<HTMLDivElement>(null);
    const normativaRef     = useRef<HTMLDivElement>(null);

    const refs = useMemo(() => ({
        herramientas: herramientasRef,
        construccion: construccionRef,
        luz:          luzRef,
        medir:        medirRef,
        vista:        vistaRef,
        exportacion:  exportacionRef,
        editar:       editarRef,
        normativa:    normativaRef,
    }) as const, []);

    const closePanel   = useCallback(() => setOpenPanel(null), []);
    const togglePanel  = useCallback(
        (id: PanelId) => setOpenPanel((prev) => (prev === id ? null : id)),
        [],
    );

    const hasCadDoc = !!engine.activeDoc;
    const isLoading = engine.isLoading || isParsing;
    const isReady   = engine.isReady;

    const handleFileUpload = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = await engine.openFile(file);
            if (ok) {
                setPendingFile(file);
                setScaleConfirmed(false);
                setTimeout(async () => {
                    const ext = engine.getDocumentExtents?.();
                    if (ext) {
                        if (store.activeScene()?.scaleConfig.isCalibrated) {
                            // If the scene is already calibrated (e.g., reloading DXF for a floor), preserve its scale!
                            setDetectedScale(store.activeScene()!.scaleConfig);
                            await applyScaleConfig(store.activeScene()!.scaleConfig, false);
                        } else {
                            const suggested = store.detectScaleFromExtents({
                                min_x: ext.minX, min_y: ext.minY, max_x: ext.maxX, max_y: ext.maxY,
                            });
                            setDetectedScale(suggested);
                            await applyScaleConfig(suggested, true);
                        }
                    } else setDetectedScale(null);
                    setIsImportModalOpen(true);
                }, 500);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engine, store],
    );

    const applyScaleConfig = useCallback(
        async (config: ScaleConfig, rescaleObjects = true) => {
            const prevEffective = getEffectiveScale(scaleConfig);
            store.setScaleConfig(config, rescaleObjects);
            setDetectedScale(config);
            setScaleConfirmed(true);
            if (pendingFile?.name.toLowerCase().endsWith('.dxf')) {
                await parseDxf?.(pendingFile, getEffectiveScale(config));
            }
        },
        [parseDxf, pendingFile, scaleConfig, store],
    );

    const handleCommand = useCallback((cmd: string) => {
        setLastCmd(cmd);
        engine.sendCommand(cmd);
        if (store.ui.activeTool !== 'select') store.setTool('select');
    }, [engine, store]);

    const handleDeleteSelected = useCallback(() => {
        const { selectedId } = store.ui;
        if (selectedId) store.removeObject(selectedId);
    }, [store]);

    const handleResetCalibration = useCallback(() => {
        store.resetCalibration();
    }, [store]);

    const handleResetView = useCallback(() => {
        store.setZoom(1);
        store.setPan(0, 0);
        engine.fitToView?.();
    }, [engine, store]);

    /* Rail groups — ordered for optimal UX flow */
    const GROUPS = useMemo(() => [
        {
            id: 'construccion' as PanelId, ref: refs.construccion,
            icon: <Building2 size={15} />, label: 'Arq.',
            hasActive: ['room', 'wall', 'education-wall', 'window', 'door', 'canopy', 'corridor', 'stair'].includes(activeTool),
        },
        {
            id: 'luz' as PanelId, ref: refs.luz,
            icon: <Lightbulb size={15} />, label: 'Luz',
            hasActive: ['fixture', 'fixture-grid'].includes(activeTool),
        },
        {
            id: 'normativa' as PanelId, ref: refs.normativa,
            icon: <Scale size={15} />, label: 'Norm.',
            hasActive: false,
            accentColor: 'text-emerald-400',
        },
        {
            id: 'herramientas' as PanelId, ref: refs.herramientas,
            icon: <Wrench size={15} />, label: 'CAD',
            hasActive: false,
        },
        {
            id: 'medir' as PanelId, ref: refs.medir,
            icon: <Ruler size={15} />, label: 'Medir',
            hasActive: activeTool === 'measure',
        },
        {
            id: 'vista' as PanelId, ref: refs.vista,
            icon: <Eye size={15} />, label: 'Vista',
            hasActive: showGrid || showIsolux,
        },
        {
            id: 'exportacion' as PanelId, ref: refs.exportacion,
            icon: <FileInput size={15} />, label: 'Doc.',
            hasActive: hasCadDoc || activeTool === 'calibrate',
        },
    ], [activeTool, hasCadDoc, refs, showGrid, showIsolux]);

    return (
        <>
            <input type="file" className="hidden" accept=".dxf,.dwg" ref={fileInputRef} onChange={handleFileUpload} />

            {/* ── Sidebar rail ── */}
            <aside
                id="dialux-toolbar"
                className="relative flex w-14 shrink-0 flex-col items-center gap-0.5
                    overflow-x-visible overflow-y-auto border-r border-gray-800/70 bg-[#12141e] py-2"
            >
                {/* Rail section: native tools */}
                <span className="mt-1 mb-0.5 px-1 text-[8px] font-bold tracking-[0.2em] text-gray-700 uppercase">
                    Tools
                </span>
                <div className="flex w-full flex-col items-center gap-0.5 px-1.5">
                    <ToolBtn tool="select" icon={<MousePointer2 size={14} />} active={activeTool} onSet={store.setTool} tip="Seleccionar (V)" />
                    <ToolBtn tool="room"   icon={<Square size={14} />}        active={activeTool} onSet={store.setTool} tip="Recinto poligonal (R)" />
                    <ToolBtn tool="wall"   icon={<Minus size={14} />}         active={activeTool} onSet={store.setTool} tip="Pared (W)" />
                    <ToolBtn tool="pan"    icon={<Hand size={14} />}          active={activeTool} onSet={store.setTool} tip="Pan (Espacio)" />
                </div>

                <Sep />

                {/* Rail section: group panels */}
                <span className="mb-0.5 px-1 text-[8px] font-bold tracking-[0.2em] text-gray-700 uppercase">
                    Grupos
                </span>
                <div className="flex w-full flex-col items-center gap-1.5 px-1.5">
                    {GROUPS.map(({ id, ref, icon, label, hasActive, accentColor }) => (
                        <div key={id as string} ref={ref as React.RefObject<HTMLDivElement>} className="w-full flex justify-center">
                            <GroupBtn
                                id={`group-${id}`}
                                icon={icon}
                                label={label}
                                isOpen={openPanel === id}
                                hasActive={hasActive}
                                onClick={() => togglePanel(id)}
                                accentColor={accentColor}
                            />
                        </div>
                    ))}
                </div>

                <Sep />

                {/* Edit */}
                <div ref={refs.editar} className="w-full flex justify-center px-1.5">
                    <GroupBtn
                        id="group-editar"
                        icon={<Trash2 size={15} />}
                        label="Editar"
                        isOpen={openPanel === 'editar'}
                        onClick={() => togglePanel('editar')}
                        accentColor="text-red-400"
                    />
                </div>

                <div className="flex-1" />

                {/* Last command pill */}
                {lastCmd && (
                    <div className="mb-1 px-1 text-center" title={lastCmd}>
                        <span className="rounded bg-cyan-950/50 px-1.5 py-0.5 font-mono text-[8px] text-cyan-700 ring-1 ring-cyan-900/40">
                            {lastCmd.length > 7 ? `${lastCmd.slice(0, 7)}…` : lastCmd}
                        </span>
                    </div>
                )}
            </aside>

            {/* ── Floating Panels ── */}
            {openPanel === 'herramientas' && (
                <FloatingPanelPortal title="Herramientas CAD" icon={<Wrench size={12} />}
                    anchorRef={refs.herramientas} onClose={closePanel}>
                    <HerramientasPanel onExecute={handleCommand} isReady={isReady} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'construccion' && (
                <FloatingPanelPortal title="Construcción" icon={<Building2 size={12} />}
                    anchorRef={refs.construccion} onClose={closePanel} width="md">
                    <ConstruccionPanel activeTool={activeTool} onSetTool={store.setTool}
                        angleSnapMode={angleSnapMode} onSetAngleSnap={store.setAngleSnapMode} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'luz' && (
                <FloatingPanelPortal title="Iluminación" icon={<Lightbulb size={13} />}
                    anchorRef={refs.luz} onClose={closePanel} width="md">
                    <LuzPanel activeTool={activeTool} onSetTool={store.setTool}
                        gridRows={store.ui.fixtureGridRows} gridCols={store.ui.fixtureGridCols}
                        onSetRows={store.setFixtureGridRows} onSetCols={store.setFixtureGridCols}
                        onOpenImportModal={() => setIsImportLuminairesModalOpen(true)} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'normativa' && (
                <FloatingPanelPortal title="Normativa de iluminación" icon={<Scale size={12} />}
                    anchorRef={refs.normativa} onClose={closePanel} width="lg">
                    <NormativaPanel
                        defaultNormativeStandard={defaultNormativeStandard}
                        onDefaultNormativeStandardChange={setDefaultNormativeStandard}
                        onApplyStandardToAllRooms={() => store.applyDefaultNormativeStandardToRooms()} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'medir' && (
                <FloatingPanelPortal title="Medición" icon={<Ruler size={13} />}
                    anchorRef={refs.medir} onClose={closePanel}>
                    <MedirPanel activeTool={activeTool} onSetTool={store.setTool}
                        onExecute={handleCommand} isReady={isReady} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'vista' && (
                <FloatingPanelPortal title="Vista y visualización" icon={<Eye size={13} />}
                    anchorRef={refs.vista} onClose={closePanel}>
                    <VistaPanel showIsolux={showIsolux} isoluxMode={isoluxMode} isReady={isReady}
                        onExecute={handleCommand} onToggleIsolux={store.toggleIsolux}
                        onSetIsoluxMode={store.setIsoluxMode} onResetView={handleResetView} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'exportacion' && (
                <FloatingPanelPortal title="Documento y exportación" icon={<FileInput size={13} />}
                    anchorRef={refs.exportacion} onClose={closePanel} width="md">
                    <ExportacionPanel hasCadDoc={hasCadDoc} isLoading={isLoading}
                        fileName={engine.fileName ?? undefined} activeTool={activeTool}
                        scaleConfig={scaleConfig} detectedScale={detectedScale}
                        scaleConfirmed={scaleConfirmed}
                        onNewDoc={() => engine.newDocument?.()}
                        onImportClick={() => fileInputRef.current?.click()}
                        onApplyScale={applyScaleConfig}
                        onCalibrate={() => { store.setTool('calibrate'); closePanel(); }}
                        onResetCalibration={handleResetCalibration}
                        defaultNormativeStandard={defaultNormativeStandard}
                        onDefaultNormativeStandardChange={setDefaultNormativeStandard}
                        onApplyStandardToAllRooms={() => store.applyDefaultNormativeStandardToRooms()} />
                </FloatingPanelPortal>
            )}

            {openPanel === 'editar' && (
                <FloatingPanelPortal title="Editar" icon={<Trash2 size={13} />}
                    anchorRef={refs.editar} onClose={closePanel}>
                    <EditarPanel onExecute={handleCommand} isReady={isReady}
                        onDeleteSelected={handleDeleteSelected} />
                </FloatingPanelPortal>
            )}

            {/* ── Import & Scale Modal ── */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="border-gray-800 bg-[#161820] text-gray-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-cyan-400">
                            <Upload size={20} /> Importar Plano CAD
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Configura la escala y unidades para{' '}
                            <span className="font-mono text-cyan-200">{pendingFile?.name}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-cyan-900/30 bg-cyan-950/20 p-4">
                            <h4 className="mb-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                                Unidades del archivo
                            </h4>
                            <select
                                value={scaleConfig?.unit || 'm'}
                                onChange={async (e) => {
                                    const unit = e.target.value as 'mm' | 'cm' | 'm';
                                    const map = {
                                        mm: { factor: 0.001, display: 'Milímetros (1000 = 1m)' },
                                        cm: { factor: 0.01,  display: 'Centímetros (100 = 1m)' },
                                        m:  { factor: 1,     display: 'Metros (1 = 1m)'         },
                                    };
                                    const { factor, display } = map[unit];
                                    await applyScaleConfig(createScaleConfig(unit, factor, display));
                                }}
                                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2
                                    text-sm text-gray-200 outline-none focus:ring-2 focus:ring-cyan-500/50"
                            >
                                <option value="mm">Milímetros (mm)</option>
                                <option value="cm">Centímetros (cm)</option>
                                <option value="m">Metros (m)</option>
                            </select>
                        </div>

                        {detectedScale && !scaleConfirmed && (
                            <div className="flex items-center justify-between rounded-lg border border-amber-600/30
                                bg-amber-950/30 p-3 text-amber-200">
                                <div>
                                    <p className="text-xs font-bold text-amber-400">Auto-detección</p>
                                    <p className="text-[10px]">{detectedScale.displayUnit}</p>
                                </div>
                                <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-500"
                                    onClick={() => applyScaleConfig(detectedScale)}>
                                    Confirmar
                                </Button>
                            </div>
                        )}

                        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
                            <h4 className="mb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Calibración manual
                            </h4>
                            <p className="mb-3 text-[11px] text-gray-500">
                                Mide una distancia conocida en el plano para calibrar la escala.
                            </p>
                            <Button variant="secondary" size="sm" className="gap-2 bg-gray-700 hover:bg-gray-600"
                                onClick={() => { store.setTool('calibrate'); setIsImportModalOpen(false); }}>
                                <Ruler size={13} /> Iniciar calibración
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="bg-cyan-600 font-bold text-white hover:bg-cyan-500"
                            onClick={() => setIsImportModalOpen(false)}>
                            Listo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Import Luminaires Modal ── */}
            <ImportLuminairesModal
                open={isImportLuminairesModalOpen}
                onOpenChange={setIsImportLuminairesModalOpen}
            />
        </>
    );
};
