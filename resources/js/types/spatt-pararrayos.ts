export interface DosisReduccion {
    rInicial: number;
    reduccion: number;
    rFinal: number;
    descripcion: string;
}

export interface PozoData {
    L: number;
    a: number;
    resistividad: number;
    tipoTerreno: string;
    isCustomA: boolean;
    dosisReduccion: DosisReduccion[];
    resultados: {
        calculado: boolean;
        resistencia: number;
    } | null;
}

export interface PararrayoData {
    td: number;
    L: number;
    W: number;
    H: number;
    h: number;
    c1: number;
    c2: number;
    c3: number;
    c4: number;
    c5: number;
    resultados: {
        calculado: boolean;
        nkng: number;
        areaEquivalente: number;
        Nd: number;
        nc: number;
        requiereProteccion: boolean;
        eficienciaRequerida: number;
        nivelProteccion: number;
    } | null;
}

export interface CollaboratorUser {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    role: 'viewer' | 'editor';
}

export interface SpreadsheetOwner {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
}

export interface SpattPararrayoSpreadsheet {
    id: number;
    name: string;
    project_name: string | null;
    pozo_data: PozoData | null;
    pararrayo_data: PararrayoData | null;
    is_collaborative: boolean;
    collab_code: string | null;
    owner: SpreadsheetOwner;
    collaborators: CollaboratorUser[];
    can_edit: boolean;
    is_owner: boolean;
}

export interface SpattPararrayoSpreadsheetSummary {
    id: number;
    name: string;
    project_name: string | null;
    is_collaborative: boolean;
    collab_code: string | null;
    owner: SpreadsheetOwner;
    updated_at: string;
    is_owner: boolean;
}
