import type { IsoDate } from '../lib/dates';

/** Profesional clave de la obra (hoja RH-EM). */
export interface PersonaClave {
    id: string;
    nombre: string;
    cargo: string;
    cantidad: number;
    dni: string;
    cip: string;
    /** Si se indica, el nombre se toma de la Ficha Técnica (no se duplica). */
    vinculoFT?: 'residente';
}

/**
 * Personal clave y asistencia. Por defecto se asume asistencia todos los días
 * de obra del mes (como el Excel): solo se guardan las FALTAS, así los días
 * asistidos se calculan y no pueden contradecirse con la grilla.
 */
export interface PersonalInput {
    personas: PersonaClave[];
    faltas: Record<string, IsoDate[]>;
}
