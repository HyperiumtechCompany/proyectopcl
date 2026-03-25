// types/metrado_estructura.ts

export interface MetradoEstructuraSpreadsheetSummary {
    id: number;
    name: string;
    project_name: string | null;
    project_location: string | null;
    building_type: string | null;
    structural_system: string | null;
    is_collaborative: boolean;
    is_owner: boolean;
    owner: {
        id: number;
        name: string;
        email: string;
    };
    summary?: {
        concrete: number;
        steel: number;
        formwork: number;
        columns: number;
        beams: number;
        slabs: number;
        footings: number;
    };
    updated_at: string;
    created_at: string;
}

export interface MetradoEstructuraSpreadsheet {
    id: number;
    name: string;
    project_name: string | null;
    project_location: string | null;
    building_type: string | null;
    structural_system: string | null;
    description: string | null;
    is_collaborative: boolean;
    owner_id: number;
    owner: {
        id: number;
        name: string;
        email: string;
    };
    // 👇 Corregido: 'role' en lugar de 'permission'
    collaborators?: Array<{
        id: number;
        name: string;
        email: string;
        role: 'viewer' | 'editor'; // Cambiado de 'permission' a 'role'
    }>;
    items?: MetradoEstructuraItem[];
    created_at: string;
    updated_at: string;
}

export interface MetradoEstructuraItem {
    id: number;
    spreadsheet_id: number;
    element_type: 'columna' | 'viga' | 'losa' | 'zapata' | 'muro' | 'escalera' | 'otros';
    code: string;
    description: string;
    quantity: number;
    unit: 'm3' | 'kg' | 'm2' | 'ml' | 'und';
    dimensions: {
        length?: number;
        width?: number;
        height?: number;
        diameter?: number;
        area?: number;
    };
    concrete: {
        volume: number;
        fc: string;
    };
    steel: {
        weight: number;
        grades: {
            grade60: number;
            grade40?: number;
        };
    };
    formwork?: {
        area: number;
        type: string;
    };
    observations: string | null;
    order: number;
    created_at: string;
    updated_at: string;
}

export interface ColumnData {
    base: number;
    height: number;
    length: number;
    reinforcement: {
        main: string;
        stirrups: string;
    };
}

export interface BeamData {
    width: number;
    height: number;
    length: number;
    reinforcement: {
        top: string;
        bottom: string;
        stirrups: string;
    };
}

export interface SlabData {
    thickness: number;
    area: number;
    reinforcement: {
        mesh: string;
        temperature: string;
    };
}