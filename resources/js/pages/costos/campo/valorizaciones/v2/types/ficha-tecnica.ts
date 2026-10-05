import Decimal from 'decimal.js';

export interface FichaTecnica {
    // A. Datos Generales
    entidad: string;
    obra: string;
    codigoUnicoInversion: string;
    sector: string;
    sistemaContratacion: string;
    modalidadEjecucion: string;
    ubicacion: {
        region: string;
        provincia: string;
        distrito: string;
        lugar: string;
    };
    
    // B. Datos Económicos
    valorReferencial: Decimal; // S/ sin IGV o con IGV dependiendo, asumimos monto total ref
    montoContrato: Decimal;    // S/ INCL IGV
    
    // C. Porcentajes
    porcentajeGG: Decimal;       // Ej: 0.0750
    porcentajeUtilidad: Decimal; // Ej: 0.0500
    porcentajeIGV: Decimal;      // Ej: 0.1800
    
    // D. Plazos y Fechas
    fechaBase: string; // ISO date string "2026-06-01"
    fechaFirmaContrato: string;
    fechaEntregaTerreno: string;
    fechaInicioPlazo: string;
    plazoEjecucionDias: number; // Ej: 90
    fechaTerminoCalculada: string; 
    
    // E. Personal
    ejecutor: string;
    supervisor: string;
    residente: string;
    ingSupervisor: string;
}
