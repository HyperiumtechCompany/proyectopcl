import { saveAs } from 'file-saver';
import type { DelphinRow } from '../types';

// ── Tipo → código MSPDI ───────────────────────────────────────────────────────
// FC = Finish-to-Start  → FS = 1
// CC = Start-to-Start   → SS = 3
// FF = Finish-to-Finish → FF = 0
// CF = Start-to-Finish  → SF = 2
const LINK_TYPE: Record<string, number> = { FC: 1, CC: 3, FF: 0, CF: 2 };

function toDuration(days: number): string {
    const h = Math.max(0, Math.round(days)) * 8;
    return `PT${h}H0M0S`;
}

function toMSDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    return `${dateStr.split('T')[0]}T08:00:00`;
}

function xmlEsc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number): string {
    return `      <${name}>${value}</${name}>\n`;
}

// ── Generador XML ──────────────────────────────────────────────────────────────
export function exportDelphinMSP(rows: DelphinRow[], projectName: string): void {
    // Nodes that have children
    const groupIds = new Set(
        rows.map((r) => r.parent_id).filter((id): id is number => id != null),
    );

    // Map DB id → sequential UID (1-based; 0 is reserved for project summary)
    const uidMap = new Map<number, number>();
    rows.forEach((r, i) => uidMap.set(r.id, i + 1));

    const today = new Date().toISOString().split('T')[0]!;

    let tasksXml = '';

    // Task 0 — project summary (required by MS Project)
    tasksXml += `    <Task>\n`;
    tasksXml += tag('UID', 0);
    tasksXml += tag('ID', 0);
    tasksXml += tag('Name', xmlEsc(projectName));
    tasksXml += tag('IsNull', 0);
    tasksXml += tag('WBS', 0);
    tasksXml += tag('OutlineLevel', 0);
    tasksXml += tag('Priority', 500);
    tasksXml += tag('Summary', 1);
    tasksXml += `    </Task>\n`;

    rows.forEach((row, i) => {
        const uid  = i + 1;
        const nivel = row.nivel ?? 1;
        const isGroup = groupIds.has(row.id);
        const start  = toMSDate(row.fecha_inicio);
        const finish = toMSDate(row.fecha_fin);

        tasksXml += `    <Task>\n`;
        tasksXml += tag('UID', uid);
        tasksXml += tag('ID', uid);
        tasksXml += tag('Name', xmlEsc(row.descripcion ?? ''));
        tasksXml += tag('Type', 0);
        tasksXml += tag('IsNull', 0);
        tasksXml += tag('WBS', xmlEsc(row.partida ?? String(uid)));
        tasksXml += tag('OutlineNumber', xmlEsc(row.partida ?? String(uid)));
        tasksXml += tag('OutlineLevel', nivel);
        tasksXml += tag('Priority', 500);
        tasksXml += tag('Summary', isGroup ? 1 : 0);
        if (row.duracion_dias) {
            tasksXml += tag('Duration', toDuration(row.duracion_dias));
            tasksXml += tag('DurationFormat', 7); // days
        }
        if (start)  tasksXml += tag('Start',  start);
        if (finish) tasksXml += tag('Finish', finish);
        if (row.presupuesto) tasksXml += tag('Cost', row.presupuesto.toFixed(2));
        if (row.avance)      tasksXml += tag('PercentComplete', Math.round(row.avance));

        // Predecessors
        if (Array.isArray(row.predecesoras)) {
            for (const p of row.predecesoras as any[]) {
                const predUid = uidMap.get(p.taskId);
                if (predUid == null) continue;
                const linkType = LINK_TYPE[p.tipo ?? 'FC'] ?? 1;
                const lagMins  = (p.lag ?? 0) * 8 * 60; // days → minutes
                tasksXml += `      <PredecessorLink>\n`;
                tasksXml += `        <PredecessorUID>${predUid}</PredecessorUID>\n`;
                tasksXml += `        <Type>${linkType}</Type>\n`;
                tasksXml += `        <CrossProject>0</CrossProject>\n`;
                tasksXml += `        <LinkLag>${lagMins}</LinkLag>\n`;
                tasksXml += `      </PredecessorLink>\n`;
            }
        }

        tasksXml += `    </Task>\n`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${xmlEsc(projectName)}</Name>
  <Title>${xmlEsc(projectName)}</Title>
  <SaveVersion>14</SaveVersion>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DefaultTaskType>0</DefaultTaskType>
  <DefaultFixedCostAccrual>3</DefaultFixedCostAccrual>
  <DefaultStandardRate>0</DefaultStandardRate>
  <DefaultOvertimeRate>0</DefaultOvertimeRate>
  <CreationDate>${today}T09:00:00</CreationDate>
  <Tasks>
${tasksXml}  </Tasks>
  <Resources/>
  <Assignments/>
</Project>`;

    const date   = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const safeName = projectName.replace(/\s+/g, '_');
    const fileName = `${safeName}_Cronograma_${date.replace(/\//g, '-')}.xml`;

    saveAs(new Blob([xml], { type: 'application/xml;charset=utf-8' }), fileName);
}
