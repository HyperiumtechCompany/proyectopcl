import { daysInMonth, weekday } from '../../lib/dates';
import type { IsoDate } from '../../lib/dates';
import type { MesKey, PersonaClave, PersonalInput } from '../../types';

const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export interface DiaMes {
    fecha: IsoDate;
    dia: number;
    /** L, M, X, J, V, S, D (como la cabecera del Excel). */
    letra: string;
    domingo: boolean;
    /** Dentro del plazo de la obra (inicio → término). */
    enObra: boolean;
}

export type EstadoDia = 'asistio' | 'falta' | 'fuera';

export interface FilaAsistencia {
    persona: PersonaClave;
    /** Nombre efectivo (de la FT si está vinculado). */
    nombre: string;
    dias: Record<IsoDate, EstadoDia>;
    diasAsistidos: number;
}

export interface Asistencia {
    dias: DiaMes[];
    diasDeObra: number;
    filas: FilaAsistencia[];
}

/**
 * RH-EM: grilla de asistencia del mes valorizado. Cada persona asiste todos los
 * días de obra salvo sus faltas; los días fuera del plazo no cuentan. Domingos
 * se resaltan pero cuentan como días de obra (el Excel suma 31 en julio).
 */
export function computeAsistencia(personal: PersonalInput, mes: MesKey, inicioObra: IsoDate, finObra: IsoDate, nombresFT: { residente: string }): Asistencia {
    const [year, month] = mes.split('-').map(Number);
    const dias: DiaMes[] = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
        const fecha = `${mes}-${String(index + 1).padStart(2, '0')}`;
        const dow = weekday(fecha);

        return { fecha, dia: index + 1, letra: LETRAS[dow], domingo: dow === 0, enObra: fecha >= inicioObra && fecha <= finObra };
    });

    const filas = personal.personas.map((persona): FilaAsistencia => {
        const faltas = new Set(personal.faltas[persona.id] ?? []);
        const estado: Record<IsoDate, EstadoDia> = {};
        let diasAsistidos = 0;
        for (const dia of dias) {
            const valor: EstadoDia = !dia.enObra ? 'fuera' : faltas.has(dia.fecha) ? 'falta' : 'asistio';
            estado[dia.fecha] = valor;
            if (valor === 'asistio') {
                diasAsistidos += 1;
            }
        }

        return { persona, nombre: persona.vinculoFT === 'residente' ? nombresFT.residente : persona.nombre, dias: estado, diasAsistidos };
    });

    return { dias, diasDeObra: dias.filter((dia) => dia.enObra).length, filas };
}
