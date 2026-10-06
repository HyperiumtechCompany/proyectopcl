import type ExcelJS from 'exceljs';
import type { ValorizacionDerivada } from '../../compute/derivarValorizacion';
import type { Expediente } from './estilo';

/** Todo lo que necesita cada constructor de hoja. */
export interface ContextoLibro {
    wb: ExcelJS.Workbook;
    d: ValorizacionDerivada;
    exp: Expediente;
    /** "02" */
    numero: string;
    /** "JULIO DE 2026" */
    mesTexto: string;
    /** "JULIO 2026" */
    mesCorto: string;
    /** Imágenes PNG (data URL) de los gráficos ya rasterizados. */
    graficos: { curvaS: string; fisico: string; financiero: string };
}

export type ConstructorHoja = (ctx: ContextoLibro) => void;
