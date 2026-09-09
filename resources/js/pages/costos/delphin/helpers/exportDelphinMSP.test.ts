import { describe, expect, it } from 'vitest';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import { buildDelphinMSPXml } from './exportDelphinMSP';

const tasks: GanttTask[] = [
    {
        id: 901,
        parent_id: null,
        nivel: 1,
        item_order: 53,
        partida: '1',
        descripcion: 'Actividad predecesora',
        duracion_dias: 2,
        fecha_inicio: '2027-02-16',
        fecha_fin: '2027-02-17',
        avance: 25,
        predecesoras: [],
        presupuesto: 150.5,
    },
    {
        id: 902,
        parent_id: null,
        nivel: 1,
        item_order: 54,
        partida: '2',
        descripcion: 'Actividad sucesora',
        duracion_dias: 10,
        fecha_inicio: '2027-02-18',
        fecha_fin: '2027-02-20',
        avance: 0,
        predecesoras: [{ taskId: 53, tipo: 'FC', lag: 1 }],
        presupuesto: 200,
    },
];

describe('buildDelphinMSPXml', () => {
    it('exports dates, duration, costs and predecessors referenced by visible item order', () => {
        const xml = buildDelphinMSPXml(tasks, 'Proyecto vial');

        expect(xml).toContain('<Name>Actividad sucesora</Name>');
        expect(xml).toContain('<Start>2027-02-18T08:00:00</Start>');
        expect(xml).toContain('<Finish>2027-02-20T17:00:00</Finish>');
        expect(xml).toContain('<Duration>PT80H0M0S</Duration>');
        expect(xml).toContain('<RemainingDuration>PT80H0M0S</RemainingDuration>');
        expect(xml).toContain('<FixedCost>200.00</FixedCost>');
        expect(xml).toContain('<PredecessorUID>1</PredecessorUID>');
        expect(xml).toContain('<Type>1</Type>');
        expect(xml).toContain('<LinkLag>4800</LinkLag>');
        expect(xml).toContain('<LagFormat>7</LagFormat>');
    });

    it('does not constrain a task that has a valid predecessor', () => {
        const xml = buildDelphinMSPXml(tasks, 'Proyecto vial');
        const successor = xml.split('<Name>Actividad sucesora</Name>')[1].split('</Task>')[0];

        expect(successor).not.toContain('<ConstraintType>2</ConstraintType>');
    });

    it('marks tasks as manually scheduled so MS Project uses Start/Finish as-is', () => {
        // Real: calendarios con horas distintas por día (ej. 9h L-V, 5h sáb/dom)
        // hacían que MS Project, al auto-programar, reconvirtiera la Duración
        // exportada en minutos usando horas-por-día uniformes — corriendo el
        // Fin semanas hacia adelante frente a lo que Delphin calculó (que
        // cuenta días completos, no horas). <Manual>1</Manual> le dice a MS
        // Project que use el Start/Finish exportado tal cual, sin recalcular.
        const xml = buildDelphinMSPXml(tasks, 'Proyecto vial');
        const successor = xml.split('<Name>Actividad sucesora</Name>')[1].split('</Task>')[0];

        expect(successor).toContain('<Manual>1</Manual>');
    });

    it('sets ManualStart/ManualFinish so MS Project keeps the real duration instead of collapsing to 1 day', () => {
        // Manual=1 por sí solo no basta: sin <ManualStart>/<ManualFinish>, MS
        // Project ignora las fechas manuales al abrir el archivo y muestra
        // cada tarea con la duración placeholder de 1 día — el bug reportado
        // en producción (todas las tareas exportadas aparecían "1 día").
        const xml = buildDelphinMSPXml(tasks, 'Proyecto vial');
        const successor = xml.split('<Name>Actividad sucesora</Name>')[1].split('</Task>')[0];

        expect(successor).toContain('<ManualStart>2027-02-18T08:00:00</ManualStart>');
        expect(successor).toContain('<ManualFinish>2027-02-20T17:00:00</ManualFinish>');
    });

    it('drops a predecessor link that points to the task\'s own ancestor group to avoid a circular reference', () => {
        // Real: Delphin permite (y tolera en su propio motor) que una subfila
        // tenga como predecesora CC a su fila padre/abuela — un patrón usado
        // para expresar "arranca junto con su fase". Delphin nunca reposiciona
        // grupos por predecesoras, así que internamente no hay ciclo. Pero al
        // exportar, la fila padre es una tarea real cuyas fechas son rollup de
        // sus hijos — si un hijo también la referencia como predecesora, MS
        // Project detecta un ciclo real y bloquea TODO el cálculo del archivo
        // (síntoma real reportado: los resúmenes/grupos colapsan a "1 día"
        // porque ya no se puede calcular su rollup).
        const grouped: GanttTask[] = [
            {
                id: 10,
                parent_id: null,
                nivel: 1,
                item_order: 1,
                partida: '1',
                descripcion: 'SEGURIDAD Y SALUD',
                duracion_dias: 270,
                fecha_inicio: '2026-09-01',
                fecha_fin: '2027-05-28',
                avance: 0,
                predecesoras: [],
                presupuesto: 0,
            },
            {
                id: 11,
                parent_id: 10,
                nivel: 2,
                item_order: 2,
                partida: '1.1',
                descripcion: 'CAPACITACION EN SEGURIDAD Y SALUD',
                duracion_dias: 10,
                fecha_inicio: '2026-09-01',
                fecha_fin: '2026-09-10',
                avance: 0,
                // CC hacia su propia fila padre (item_order 1) — el patrón real.
                predecesoras: [{ taskId: 1, tipo: 'CC', lag: 0 }],
                presupuesto: 100,
            },
        ];

        const xml = buildDelphinMSPXml(grouped, 'Proyecto vial');
        const child = xml
            .split('<Name>CAPACITACION EN SEGURIDAD Y SALUD</Name>')[1]
            .split('</Task>')[0];

        expect(child).not.toContain('<PredecessorLink>');
        // Sin predecesoras, debe anclarse por restricción de fecha en vez de
        // quedar sin fecha de referencia.
        expect(child).toContain('<ConstraintType>2</ConstraintType>');
    });

    it('keeps a predecessor link to a summary task that is not an ancestor (legitimate cross-phase dependency)', () => {
        const grouped: GanttTask[] = [
            {
                id: 20,
                parent_id: null,
                nivel: 1,
                item_order: 1,
                partida: '1',
                descripcion: 'DEMOLICIONES',
                duracion_dias: 5,
                fecha_inicio: '2026-09-01',
                fecha_fin: '2026-09-05',
                avance: 0,
                predecesoras: [],
                presupuesto: 0,
            },
            {
                id: 21,
                parent_id: 20,
                nivel: 2,
                item_order: 2,
                partida: '1.1',
                descripcion: 'Hijo de demoliciones',
                duracion_dias: 5,
                fecha_inicio: '2026-09-01',
                fecha_fin: '2026-09-05',
                avance: 0,
                predecesoras: [],
                presupuesto: 0,
            },
            {
                id: 22,
                parent_id: null,
                nivel: 1,
                item_order: 3,
                partida: '2',
                descripcion: 'CORTE EN TERRENO NORMAL',
                duracion_dias: 5,
                fecha_inicio: '2026-09-06',
                fecha_fin: '2026-09-10',
                avance: 0,
                // Referencia a "DEMOLICIONES" (grupo), pero NO es su ancestro.
                predecesoras: [{ taskId: 1, tipo: 'FC', lag: 0 }],
                presupuesto: 0,
            },
        ];

        const xml = buildDelphinMSPXml(grouped, 'Proyecto vial');
        const successor = xml
            .split('<Name>CORTE EN TERRENO NORMAL</Name>')[1]
            .split('</Task>')[0];

        expect(successor).toContain('<PredecessorLink>');
    });
});
