// Tipos para el módulo de metrado de electricas

export interface SpreadsheetOwner {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
}

export interface CollaboratorUser {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    role: 'viewer' | 'editor';
}

export interface MetradoElectricasSpreadsheet {
    id: number;
    name: string;
    project_name: string | null;
    sheet_data: any | null; // Luckysheet JSON payload
    is_collaborative: boolean;
    collab_code: string | null;
    owner: SpreadsheetOwner;
    collaborators: CollaboratorUser[];
    can_edit: boolean;
    is_owner: boolean;
}

export interface MetradoElectricasSpreadsheetSummary {
    id: number;
    name: string;
    project_name: string | null;
    is_collaborative: boolean;
    collab_code: string | null;
    owner: SpreadsheetOwner;
    updated_at: string;
    is_owner: boolean;
}
