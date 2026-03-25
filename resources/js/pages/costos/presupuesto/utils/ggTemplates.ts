// utils/ggTemplates.ts
import { TipoFilaVariable, GGVariableNode } from '../stores/ggVariablesStore';

export interface GGTemplate {
    label: string;
    description: string;
    nodes: any[]; // Usamos any para permitir tanto GGVariableNode como GGFijoNode
}

export const GGVARIABLES_TEMPLATES: Record<string, GGTemplate> = {
    standard_complete: {
        label: 'Estructura Estándar PCL',
        description: 'Estructura completa 2.01 a 2.08 según imágenes',
        nodes: [
            // 2.01 GASTOS DE ADMINISTRACIÓN EN OBRA
            { tipo_fila: 'seccion', item_codigo: '2.01', descripcion: 'GASTOS DE ADMINISTRACIÓN EN OBRA' },
            { tipo_fila: 'grupo', item_codigo: '', descripcion: 'Sueldos y beneficios' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Ingeniero Principal Residente de la Obra', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 9500 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista en Estructuras', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 4, participacion: 50, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista en Arquitectura', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 3, participacion: 50, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista Sanitario', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 2, participacion: 50, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista Electromecanico', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 2, participacion: 50, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista en Mecanica de Suelos', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 25, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista Planeamiento y Costos', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 50, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista de Calidad', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 2, participacion: 25, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista en Equipamiento', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 25, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Especialista en Estudio e Impacto Ambiental', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 6200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Administrador de Obra', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 3600 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Maestro de Obra', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 3400 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Almacenero', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 1500 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Guardiania (OG)', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 1500 },

            // 2.02 Pago de Beneficios Sociales
            { tipo_fila: 'seccion', item_codigo: '2.02', descripcion: 'Pago de Beneficios Sociales' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Asignación Familiar (10% de RMV)', unidad: 'Glb', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 0 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- ESSALUD (9% P. Unit. - Aporta el Empleador)', unidad: 'Glb', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 0 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- C.T.S. (8.3333% P. Unit.)', unidad: 'Glb', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 0 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Vacaciones (1/12 de (P. Unit.+ Asig. Fam.))', unidad: 'Glb', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 0 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Gratificación (1/6 PUnit. x 2)', unidad: 'Glb', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 0 },

            // 2.03 Equipamiento y Mobiliario
            { tipo_fila: 'seccion', item_codigo: '2.03', descripcion: 'Equipamiento y Mobiliario' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Utiles de escritorio, ploteos', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 246.99 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Computadoras e impresora', unidad: 'und', cantidad_descripcion: 1, cantidad_tiempo: 2, participacion: 100, precio: 3800 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Mobiliarios de oficina', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 120 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Equipo de Laboratorio de Concreto', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 2, participacion: 100, precio: 1200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Equipo de Laboratorio de Suelos', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 2, participacion: 100, precio: 1200 },

            // 2.04 Ensayos y pruebas de calidad
            { tipo_fila: 'seccion', item_codigo: '2.04', descripcion: 'Ensayos y pruebas de calidad' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Diseño de mezclas', unidad: 'und', cantidad_descripcion: 1, cantidad_tiempo: 3, participacion: 100, precio: 400 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Pruebas de Calidad en estructuras metalicas', unidad: 'und', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 4200 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Roturas de probeta', unidad: 'und', cantidad_descripcion: 60, cantidad_tiempo: 1, participacion: 100, precio: 25 },

            // 2.05 Alquileres, servicios, equipos de oficina...
            { tipo_fila: 'seccion', item_codigo: '2.05', descripcion: 'Alquileres, servicios, equipos de oficina de obra y comunicaciones' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Alquiler local de oficina', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 600 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Alquiler local para Alojamiento', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 300 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Equipos de comunicación', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 80 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Grupo Electrogeno 20 Kw', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 50, precio: 300 },

            // 2.06 Vehículos
            { tipo_fila: 'seccion', item_codigo: '2.06', descripcion: 'Vehículos para Movilidad y Transporte interno:' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: 'Camionetas Pick Up Doble Cabina 4x4 c/radio transmisor (*)', unidad: 'mes', cantidad_descripcion: 1, cantidad_tiempo: 6, participacion: 100, precio: 6200 },

            // 2.07 Gastos Financieros
            { tipo_fila: 'seccion', item_codigo: '2.07', descripcion: 'Gastos Finacieros Complementarios - Renovacion de Fianzas' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Fianza por Garantía de Adelanto en Efectivo', unidad: '', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 8.14 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Fianza por Garantía de Adelanto en Materiales', unidad: '', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 16.29 },

            // 2.08 Recepción y Liquidación
            { tipo_fila: 'seccion', item_codigo: '2.08', descripcion: 'ETAPA RECEPCIÓN Y LIQUIDACION DE OBRA' },
            { tipo_fila: 'grupo', item_codigo: '02.08.01', descripcion: 'Sueldos y Salarios (Incluidos Beneficios Sociales)' },
            { tipo_fila: 'grupo', item_codigo: '02.08.01.02', descripcion: 'Personal Profesional Clave' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: 'Ingeniero Residente', unidad: 'Mes', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 14000 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: 'Especialista Planeamiento y Costos', unidad: 'Mes', cantidad_descripcion: 0.5, cantidad_tiempo: 1, participacion: 100, precio: 9240 },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: 'Administrador', unidad: 'Mes', cantidad_descripcion: 0.5, cantidad_tiempo: 1, participacion: 100, precio: 5300 },
            { tipo_fila: 'grupo', item_codigo: '02.08.02', descripcion: 'Oficinas Adm. Campo: Útiles de Oficina' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: 'Oficinas incl. Mobiliario y utiles de ofic.', unidad: 'Mes', cantidad_descripcion: 1, cantidad_tiempo: 1, participacion: 100, precio: 400 }
        ]
    },
    standard_fijos: {
        label: 'Gastos Fijos Estándar',
        description: 'Fianzas, Seguros e Impuestos (Vínculo automático)',
        nodes: [
            // 01.01.00 Fianzas: Contratación
            { tipo_fila: 'seccion', item_codigo: '01.01.00', descripcion: 'Fianzas: Contratación' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Fianza por Garantía de Fiel Cumplimiento ((Vigencia hasta la liquidación)', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'fianza_fiel_cumplimiento' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Fianza por Garantía de Adelanto en Efectivo', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'fianza_adelanto_efectivo' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Fianza por Garantía de Adelanto en Materiales', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'fianza_adelanto_materiales' },

            // 01.02.00 Seguros: Contratación
            { tipo_fila: 'seccion', item_codigo: '01.02.00', descripcion: 'Seguros: Contratación' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Póliza de Seguros C.A.R. Contra Todo Riesgo (vigencia durante ejecución de la obra)', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'poliza_car' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Ensayo de compresion de testigos', unidad: 'und', cantidad: 25, costo_unitario: 44, tipo_calculo: 'manual' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Póliza SCTR del Personal de Administración y Control de Obra - Gastos Generales (vigencia durante ejec. de obra)', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'poliza_sctr' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- PÓLIZA DE SEGUROS ESSALUD + VIDA', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'poliza_essalud_vida' },

            // 01.03.00 Impuestos Pago Sencico e ITF
            { tipo_fila: 'seccion', item_codigo: '01.03.00', descripcion: 'Impuestos Pago Sencico e ITF' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Sencico (0.20% del ppto)', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'sencico' },
            { tipo_fila: 'detalle', item_codigo: '', descripcion: '- Impuestos ITF', unidad: 'glb', cantidad: 1, costo_unitario: 0, tipo_calculo: 'itf' },
        ]
    }
};

