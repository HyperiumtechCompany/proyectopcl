import { saveAs } from 'file-saver';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import type { GanttCalendarSettings, WeekdayKey } from '../../cronogramas/v2/types/calendar';

// ── Tipo → código MSPDI ───────────────────────────────────────────────────────
// FC = Finish-to-Start  → FS = 1
// CC = Start-to-Start   → SS = 3
// FF = Finish-to-Finish → FF = 0
// CF = Start-to-Finish  → SF = 2
const LINK_TYPE: Record<string, number> = { FC: 1, CC: 3, FF: 0, CF: 2 };

function timeToMinutes(time: string): number {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function workingMinutesPerDay(settings?: GanttCalendarSettings): number {
    if (!settings) return 480;
    const enabledDay = Object.values(settings.workDays).find((day) => day.enabled);
    if (!enabledDay) return 480;
    return Math.max(1, timeToMinutes(enabledDay.end) - timeToMinutes(enabledDay.start));
}

function toDuration(days: number, minutesPerDay: number): string {
    const totalMinutes = Math.max(0, Math.round(days * minutesPerDay));
    const hours = Math.floor(totalMinutes / 60);
    return `PT${hours}H${totalMinutes % 60}M0S`;
}

function toMSDate(
    dateStr: string | null | undefined,
    time: string,
): string {
    if (!dateStr) return '';
    return `${dateStr.split('T')[0]}T${time}:00`;
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
function outlineNumbers(rows: GanttTask[]): string[] {
    const counters: number[] = [];

    return rows.map((row) => {
        const level = Math.max(1, row.nivel ?? 1);
        counters.length = level;
        counters[level - 1] = (counters[level - 1] ?? 0) + 1;
        for (let index = 0; index < level - 1; index++) {
            counters[index] ??= 1;
        }
        return counters.join('.');
    });
}

function calendarXml(settings?: GanttCalendarSettings): string {
    if (!settings) return '';

    const dayTypes: Array<[WeekdayKey, number]> = [
        ['sun', 1], ['mon', 2], ['tue', 3], ['wed', 4],
        ['thu', 5], ['fri', 6], ['sat', 7],
    ];
    const weekDays = dayTypes.map(([key, dayType]) => {
        const day = settings.workDays[key];
        const times = day.enabled
            ? `<WorkingTimes><WorkingTime><FromTime>${day.start}:00</FromTime><ToTime>${day.end}:00</ToTime></WorkingTime></WorkingTimes>`
            : '';
        return `<WeekDay><DayType>${dayType}</DayType><DayWorking>${day.enabled ? 1 : 0}</DayWorking>${times}</WeekDay>`;
    }).join('');
    const exceptions = settings.holidays.map((holiday) =>
        `<Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>${holiday.date}T00:00:00</FromDate><ToDate>${holiday.date}T23:59:59</ToDate></TimePeriod><Occurrences>1</Occurrences><Name>${xmlEsc(holiday.name)}</Name><Type>1</Type><DayWorking>0</DayWorking></Exception>`,
    ).join('');

    return `<Calendars><Calendar><UID>1</UID><Name>Calendario del proyecto</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID><WeekDays>${weekDays}</WeekDays>${exceptions ? `<Exceptions>${exceptions}</Exceptions>` : ''}</Calendar></Calendars>`;
}

export function buildDelphinMSPXml(
    rows: GanttTask[],
    projectName: string,
    calendarSettings?: GanttCalendarSettings,
): string {
    // Nodes that have children
    const groupIds = new Set(
        rows.map((r) => r.parent_id).filter((id): id is number => id != null),
    );

    // Map DB id → sequential UID (1-based; 0 is reserved for project summary)
    const uidMap = new Map<number, number>();
    const uidByItemOrder = new Map<number, number>();
    rows.forEach((r, i) => uidMap.set(r.id, i + 1));
    rows.forEach((r, i) => uidByItemOrder.set(Number(r.item_order), i + 1));

    const today = new Date().toISOString().split('T')[0]!;
    const outlines = outlineNumbers(rows);
    const enabledDay = calendarSettings
        ? Object.values(calendarSettings.workDays).find((day) => day.enabled)
        : undefined;
    const startTime = enabledDay?.start ?? '08:00';
    const finishTime = enabledDay?.end ?? '17:00';
    const minutesPerDay = workingMinutesPerDay(calendarSettings);
    const workingDaysPerWeek = calendarSettings
        ? Object.values(calendarSettings.workDays).filter((day) => day.enabled).length
        : 5;
    const projectStart = calendarSettings?.projectStart
        ?? rows.map((row) => row.fecha_inicio).filter((date): date is string => Boolean(date)).sort()[0]
        ?? today;
    const projectFinish = calendarSettings?.projectEnd
        ?? rows.map((row) => row.fecha_fin).filter((date): date is string => Boolean(date)).sort().at(-1)
        ?? projectStart;

    let tasksXml = '';

    // Task 0 — project summary (required by MS Project)
    tasksXml += `    <Task>\n`;
    tasksXml += tag('UID', 0);
    tasksXml += tag('ID', 0);
    tasksXml += tag('Name', xmlEsc(projectName));
    tasksXml += tag('Type', 1);
    tasksXml += tag('IsNull', 0);
    tasksXml += tag('WBS', 0);
    tasksXml += tag('OutlineNumber', 0);
    tasksXml += tag('OutlineLevel', 0);
    tasksXml += tag('Priority', 500);
    tasksXml += tag('Start', toMSDate(projectStart, startTime));
    tasksXml += tag('Finish', toMSDate(projectFinish, finishTime));
    tasksXml += tag('Duration', toDuration(0, minutesPerDay));
    tasksXml += tag('DurationFormat', 7);
    tasksXml += tag('Milestone', 0);
    tasksXml += tag('Summary', 1);
    tasksXml += `    </Task>\n`;

    rows.forEach((row, i) => {
        const uid  = i + 1;
        const nivel = row.nivel ?? 1;
        const isGroup = groupIds.has(row.id);
        const start  = toMSDate(row.fecha_inicio, startTime);
        const finish = toMSDate(row.fecha_fin, finishTime);
        const durationDays = Math.max(0, Number(row.duracion_dias) || 0);
        const duration = toDuration(durationDays, minutesPerDay);
        const progress = Math.min(100, Math.max(0, Number(row.avance) || 0));
        const remainingDuration = toDuration(
            durationDays * (1 - progress / 100),
            minutesPerDay,
        );
        const predecessors = Array.isArray(row.predecesoras)
            ? row.predecesoras.map((predecessor) => ({
                predecessor,
                uid: uidByItemOrder.get(Number(predecessor.taskId))
                    ?? uidMap.get(Number(predecessor.taskId)),
            })).filter((link): link is { predecessor: typeof row.predecesoras[number]; uid: number } => link.uid != null)
            : [];

        tasksXml += `    <Task>\n`;
        tasksXml += tag('UID', uid);
        tasksXml += tag('ID', uid);
        tasksXml += tag('Name', xmlEsc(row.descripcion ?? ''));
        tasksXml += tag('Type', 1);
        tasksXml += tag('IsNull', 0);
        tasksXml += tag('WBS', xmlEsc(row.partida ?? String(uid)));
        tasksXml += tag('OutlineNumber', outlines[i]);
        tasksXml += tag('OutlineLevel', nivel);
        tasksXml += tag('Priority', 500);
        // Manual (no auto-programada): con tareas auto-programadas, MS Project
        // IGNORA el Start/Finish exportado y recalcula el Fin desde
        // Duración+Calendario — y si el calendario tiene horas distintas por
        // día (ej. 9h L-V pero 5h sáb/dom, caso real de producción), esa
        // reconversión de minutos a días corre las fechas semanas hacia
        // adelante respecto a lo que Delphin ya calculó correctamente (Delphin
        // cuenta días completos, sin fraccionar por horas). Con Manual=1, MS
        // Project usa el Start/Finish tal cual se exportan, sin recalcular.
        tasksXml += tag('Manual', 1);
        if (start)  tasksXml += tag('Start', start);
        if (finish) tasksXml += tag('Finish', finish);
        tasksXml += tag('Duration', duration);
        tasksXml += tag('DurationFormat', 7); // days
        tasksXml += tag('Work', duration);
        tasksXml += tag('EffortDriven', 0);
        tasksXml += tag('Estimated', 0);
        tasksXml += tag('Milestone', durationDays === 0 && !isGroup ? 1 : 0);
        tasksXml += tag('Summary', isGroup ? 1 : 0);
        if (!isGroup && row.presupuesto) {
            tasksXml += tag('FixedCost', row.presupuesto.toFixed(2));
            tasksXml += tag('FixedCostAccrual', 3);
        }
        tasksXml += tag('PercentComplete', Math.round(progress));
        tasksXml += tag('PercentWorkComplete', Math.round(progress));
        if (!isGroup && row.presupuesto) tasksXml += tag('Cost', row.presupuesto.toFixed(2));
        tasksXml += tag('RegularWork', duration);
        tasksXml += tag('RemainingDuration', remainingDuration);
        if (!isGroup && start && predecessors.length === 0) {
            tasksXml += tag('ConstraintType', 2);
            tasksXml += tag('CalendarUID', 1);
            tasksXml += tag('ConstraintDate', start);
        } else {
            tasksXml += tag('CalendarUID', 1);
        }

        // Predecessors
        if (predecessors.length > 0) {
            for (const { predecessor: p, uid: predUid } of predecessors) {
                const linkType = LINK_TYPE[p.tipo ?? 'FC'] ?? 1;
                const lagTenthsOfMinute = (p.lag ?? 0) * minutesPerDay * 10;
                tasksXml += `      <PredecessorLink>\n`;
                tasksXml += `        <PredecessorUID>${predUid}</PredecessorUID>\n`;
                tasksXml += `        <Type>${linkType}</Type>\n`;
                tasksXml += `        <CrossProject>0</CrossProject>\n`;
                tasksXml += `        <LinkLag>${lagTenthsOfMinute}</LinkLag>\n`;
                tasksXml += `        <LagFormat>7</LagFormat>\n`;
                tasksXml += `      </PredecessorLink>\n`;
            }
        }

        tasksXml += `    </Task>\n`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${xmlEsc(projectName)}</Name>
  <Title>${xmlEsc(projectName)}</Title>
  <CreationDate>${today}T09:00:00</CreationDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${toMSDate(projectStart, startTime)}</StartDate>
  <FinishDate>${toMSDate(projectFinish, finishTime)}</FinishDate>
  <CurrencyDigits>2</CurrencyDigits>
  <CurrencySymbol>S/</CurrencySymbol>
  <CurrencyCode>PEN</CurrencyCode>
  <CurrencySymbolPosition>0</CurrencySymbolPosition>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>${startTime}:00</DefaultStartTime>
  <DefaultFinishTime>${finishTime}:00</DefaultFinishTime>
  <MinutesPerDay>${minutesPerDay}</MinutesPerDay>
  <MinutesPerWeek>${minutesPerDay * workingDaysPerWeek}</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DefaultTaskType>1</DefaultTaskType>
  <DefaultFixedCostAccrual>3</DefaultFixedCostAccrual>
  <DefaultStandardRate>0</DefaultStandardRate>
  <DefaultOvertimeRate>0</DefaultOvertimeRate>
  ${calendarXml(calendarSettings)}
  <Tasks>
${tasksXml}  </Tasks>
  <Resources/>
  <Assignments/>
</Project>`;

    return xml;
}

export function exportDelphinMSP(
    rows: GanttTask[],
    projectName: string,
    calendarSettings?: GanttCalendarSettings,
): void {
    const xml = buildDelphinMSPXml(rows, projectName, calendarSettings);
    const date = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const safeName = projectName.trim().replace(/\s+/g, '_');
    const fileName = `${safeName}_Cronograma_${date.replace(/\//g, '-')}.xml`;

    saveAs(new Blob([xml], { type: 'application/xml;charset=utf-8' }), fileName);
}
