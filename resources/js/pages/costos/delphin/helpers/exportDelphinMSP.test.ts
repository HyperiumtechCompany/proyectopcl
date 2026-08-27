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
});
