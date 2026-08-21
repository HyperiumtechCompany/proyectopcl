import type { Project as EditorProject } from '@/pages/dialux/hooks/useEditorStore';

export type ModuleStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export interface DialuxV2Project {
    id: number;
    name: string;
    description?: string | null;
    client_name?: string | null;
    location?: string | null;
    project_code?: string | null;
    status: ModuleStatus;
}

export interface DialuxV2ProjectListItem extends DialuxV2Project {
    modules_count: number;
    updated_at: string;
}

export interface DialuxV2Module {
    id: number;
    name: string;
    description: string | null;
    status: ModuleStatus;
    kind: 'general' | 'building' | 'exterior' | 'custom';
    sort_order: number;
    rooms_count?: number;
    luminaires_count?: number;
    installed_power_w?: number;
    compliant_rooms?: number;
    non_compliant_rooms?: number;
}

export interface DialuxV2EditorModule extends Omit<
    DialuxV2Module,
    'description' | 'sort_order'
> {
    data: EditorProject | null;
}

export interface DialuxV2ModuleSummary {
    id: number;
    name: string;
    status: ModuleStatus;
    scenes_count: number;
    rooms_count: number;
    plans_count: number;
    luminaires_count: number;
    outlets_count: number;
    panels_count: number;
    installed_power_w: number;
    compliant_rooms: number;
    non_compliant_rooms: number;
    warning_rooms: number;
}

export interface DialuxV2ProjectSummary {
    generated_at: string;
    totals: {
        modules: number;
        scenes: number;
        rooms: number;
        plans: number;
        luminaires: number;
        outlets: number;
        panels: number;
        installed_power_w: number;
        compliant_rooms: number;
        non_compliant_rooms: number;
        warning_rooms: number;
    };
    modules: DialuxV2ModuleSummary[];
}
