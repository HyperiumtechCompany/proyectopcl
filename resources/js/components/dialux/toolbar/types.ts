import type { AngleSnapMode, IsoluxMode } from '@/hooks/dialux/useEditorStore';

export type PanelId =
    | 'herramientas'
    | 'construccion'
    | 'luz'
    | 'medir'
    | 'vista'
    | 'editar'
    | 'exportacion'
    | 'normativa'
    | 'proyecto'
    | null;

export type PanelWidth = 'sm' | 'md' | 'lg' | 'xl';

export const ANGLE_SNAP_OPTIONS: Array<{
    value: AngleSnapMode;
    label: string;
    hint: string;
}> = [
    { value: 'smart', label: 'Inteligente', hint: 'Asistido + libre' },
    { value: 'free', label: 'Libre', hint: 'Sin restricción' },
    { value: 'orthogonal', label: 'Ortogonal', hint: '0 · 90 · 180 · 270°' },
    { value: 'diagonal', label: 'Diagonal', hint: '30 · 45 · 60°' },
    { value: 'fine', label: 'Fino 15°', hint: 'Cada 15° (24 ángulos)' },
];

export const ISOLUX_MODES: Array<{ value: IsoluxMode; label: string }> = [
    { value: 'functional', label: 'Funcional' },
    { value: 'waves', label: 'Ondas' },
    { value: 'temperature', label: 'Temperatura' },
];
