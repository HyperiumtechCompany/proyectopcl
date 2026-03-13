// types/metrado_gas.ts

export interface MetradoGasSpreadsheetSummary {
    id: number;
    name: string;
    project_name: string | null;
    project_location: string | null;
    building_type: string | null;
    gas_type: string | null;           // 'gn' | 'glp' | 'gnv' | 'industrial'
    installation_type: string | null;   // 'residencial' | 'comercial' | 'industrial' | 'mixta'
    is_collaborative: boolean;
    is_owner: boolean;
    owner: {
        id: number;
        name: string;
        email: string;
    };
    summary?: {
        pipes: number;          // Longitud total de tuberías en metros
        fittings: number;       // Cantidad total de accesorios
        valves: number;         // Cantidad total de válvulas
        equipment: number;      // Cantidad total de equipos
        pressure_regulators: number; // Reguladores de presión
        meters: number;         // Medidores
    };
    updated_at: string;
    created_at: string;
}

export interface MetradoGasSpreadsheet {
    id: number;
    name: string;
    project_name: string | null;
    project_location: string | null;
    building_type: string | null;
    gas_type: string | null;           // 'gn' | 'glp' | 'gnv' | 'industrial'
    installation_type: string | null;   // 'residencial' | 'comercial' | 'industrial' | 'mixta'
    description: string | null;
    is_collaborative: boolean;
    owner_id: number;
    owner: {
        id: number;
        name: string;
        email: string;
    };
    collaborators?: Array<{
        id: number;
        name: string;
        email: string;
        role: 'viewer' | 'editor';
    }>;
    items?: MetradoGasItem[];
    created_at: string;
    updated_at: string;
}

export interface MetradoGasItem {
    id: number;
    spreadsheet_id: number;
    element_type: 'tuberia' | 'accesorio' | 'valvula' | 'equipo' | 'regulador' | 'medidor' | 'prueba' | 'otros';
    code: string;
    description: string;
    quantity: number;
    unit: 'ml' | 'm' | 'und' | 'm3/h' | 'bar' | 'psi';
    dimensions: {
        diameter?: number;      // Diámetro en mm
        length?: number;        // Largo en metros
        width?: number;         // Ancho en metros
        height?: number;        // Alto en metros
        thickness?: number;     // Espesor en mm
    };
    gas_parameters: {
        pressure: {
            nominal?: number;   // Presión nominal en bar/psi
            test?: number;      // Presión de prueba
            drop?: number;      // Caída de presión permitida
        };
        flow: {
            rate?: number;      // Caudal en m³/h
            velocity?: number;  // Velocidad en m/s
        };
        material: {
            type: string;       // Tipo de material (cobre, acero, etc.)
            grade?: string;     // Grado del material
            standard?: string;  // Norma (ASTM, NTP, etc.)
        };
    };
    installation: {
        location: string;       // Ubicación en la red
        connection_type: string; // Tipo de conexión (soldada, roscada, etc.)
        isolation_required: boolean; // Requiere aislamiento
    };
    testing: {
        required: boolean;
        type?: string;          // 'hermeticidad' | 'presion' | 'funcionamiento'
        pressure?: number;      // Presión de prueba
        duration?: number;      // Duración en horas
    };
    observations: string | null;
    order: number;
    created_at: string;
    updated_at: string;
}

export interface PipeData {
    diameter: number;           // Diámetro en mm
    length: number;             // Longitud en metros
    material: {
        type: string;           // 'cobre' | 'acero' | 'polietileno' | 'acero_inoxidable'
        schedule?: string;      // 'SCH40' | 'SCH80' | etc.
        standard: string;       // 'ASTM B88' | 'ASTM A53' | etc.
    };
    fittings: {
        elbows: number;         // Número de codos
        tees: number;           // Número de tes
        reducers: number;       // Número de reducciones
        unions: number;         // Número de uniones
    };
    pressure_rating: number;    // Clase de presión en bar
    application: 'alta_presion' | 'baja_presion' | 'media_presion';
    insulation_required: boolean;
}

export interface ValveData {
    type: 'esfera' | 'compuerta' | 'globo' | 'mariposa' | 'check' | 'seguridad';
    diameter: number;           // Diámetro en mm
    material: string;           // 'bronce' | 'acero' | 'acero_inoxidable'
    connection: string;         // 'roscada' | 'bridada' | 'soldada'
    pressure_rating: number;    // Clase de presión
    actuation: 'manual' | 'automatica' | 'motorizada';
    fail_position: 'abierta' | 'cerrada' | 'ultima_posicion';
    accessories?: {
        positioner?: boolean;
        limit_switches?: boolean;
        solenoid?: boolean;
    };
}

export interface EquipmentData {
    type: 'calentador' | 'caldera' | 'cocina' | 'horno' | 'secador' | 'quemador';
    brand?: string;
    model?: string;
    capacity: {
        value: number;
        unit: 'kW' | 'BTU' | 'm3/h' | 'L';
    };
    gas_type: 'gn' | 'glp' | 'gnv' | 'industrial';
    consumption: {
        nominal: number;        // Consumo nominal en m³/h
        max: number;            // Consumo máximo en m³/h
        min: number;            // Consumo mínimo en m³/h
    };
    pressure_requirements: {
        supply: number;         // Presión de suministro requerida
        operating: number;      // Presión de operación
    };
    connections: {
        inlet: string;          // Diámetro de conexión de entrada
        outlet: string;         // Diámetro de conexión de salida
        vent?: string;          // Diámetro de ventilación
    };
    safety_features: string[];
    certifications: string[];
}

export interface PressureRegulatorData {
    type: 'primera_etapa' | 'segunda_etapa' | 'alta_presion' | 'baja_presion';
    diameter: number;
    material: string;
    pressure_range: {
        inlet_min: number;
        inlet_max: number;
        outlet_min: number;
        outlet_max: number;
    };
    capacity: {
        max: number;            // Caudal máximo en m³/h
        unit: 'm3/h';
    };
    connection_type: 'roscada' | 'bridada';
    features: string[];
    fail_mode: 'abierta' | 'cerrada';
}

export interface TestingData {
    test_type: 'hermeticidad' | 'presion' | 'funcionamiento';
    medium: 'aire' | 'nitrogeno' | 'gas';
    pressure: {
        test: number;
        max: number;
        min: number;
    };
    duration: number;           // Duración en horas
    acceptance_criteria: string;
    sections_tested: {
        from: string;
        to: string;
        length: number;
    }[];
    instruments_used: {
        type: string;
        range: string;
        calibration_date: string;
    }[];
    results: {
        passed: boolean;
        leaks_found?: number;
        pressure_drop?: number;
        observations?: string;
    };
}