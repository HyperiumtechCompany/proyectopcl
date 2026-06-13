import type { GanttTask, Predecessor, PredecessorType } from '../types/task';

// ─── Mapeo de tipos de vínculo MS Project → V2 ────────────────────────────────
// MS Project: 0=FF, 1=FS, 2=SF, 3=SS
const LINK_TYPE_MAP: Record<string, PredecessorType> = {
    '0': 'FF',
    '1': 'FC', // FS = Finish→Start
    '2': 'CF', // SF = Start→Finish
    '3': 'CC', // SS = Start→Start
};

/** Parsea duración ISO 8601 de MSP (ej: "PT40H0M0S") a días laborables */
function parseDuration(raw: string | null | undefined): number {
    if (!raw) return 1;
    // Formato PT#H#M#S o P#DT#H
    const days = raw.match(/(\d+(?:\.\d+)?)D/)?.[1];
    const hours = raw.match(/(\d+(?:\.\d+)?)H/)?.[1];
    if (days) return Math.max(1, Math.round(parseFloat(days)));
    if (hours) return Math.max(1, Math.round(parseFloat(hours) / 8));
    return 1;
}

/** Extrae texto de un nodo hijo directo */
function childText(node: Element, tag: string): string {
    return node.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? '';
}

/** Convierte fecha MSP (2025-04-10T08:00:00) a YYYY-MM-DD */
function parseDate(raw: string): string | null {
    if (!raw) return null;
    return raw.slice(0, 10) || null;
}

/**
 * Importa un archivo MS Project XML y devuelve un array de GanttTask.
 * Solo se usa en el frontend — no hace ninguna llamada a la API.
 */
export function parseMSProjectXML(xmlText: string): GanttTask[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const err = doc.querySelector('parseerror');
    if (err) throw new Error('El archivo XML no es válido: ' + err.textContent);

    const taskNodes = Array.from(doc.querySelectorAll('Tasks > Task'));
    if (taskNodes.length === 0)
        throw new Error('No se encontraron tareas en el XML.');

    // ── Primera pasada: recoger datos básicos ─────────────────────────────────
    interface RawTask {
        uid: number;
        id: number;
        name: string;
        duration: number;
        start: string | null;
        finish: string | null;
        wbs: string;
        outlineLevel: number;
        isSummary: boolean;
        predLinks: { uid: number; type: string; lag: number }[];
    }

    const rawTasks: RawTask[] = [];

    for (const node of taskNodes) {
        const uid = parseInt(childText(node, 'UID') || '0');
        const id = parseInt(childText(node, 'ID') || '0');
        const outlineLevel = parseInt(childText(node, 'OutlineLevel') || '1');
        const isSummary = childText(node, 'Summary') === '1';
        const name = childText(node, 'Name');

        // Ignorar la fila raíz (UID=0 o OutlineLevel=0) que MSP agrega
        if (uid === 0 || id === 0 || !name) continue;

        const predLinks: RawTask['predLinks'] = [];
        for (const link of node.querySelectorAll(':scope > PredecessorLink')) {
            const predUid = parseInt(
                link.querySelector('PredecessorUID')?.textContent ?? '0',
            );
            const type = link.querySelector('Type')?.textContent?.trim() ?? '1';
            const lagStr = link.querySelector('LinkLag')?.textContent ?? '0';
            // LinkLag viene en décimas de minuto en MSP; convertir a días
            const lagDays = Math.round(parseInt(lagStr) / 4800); // 4800 = 8h * 60min * 10
            if (predUid > 0)
                predLinks.push({ uid: predUid, type, lag: lagDays });
        }

        rawTasks.push({
            uid,
            id,
            name,
            duration: parseDuration(childText(node, 'Duration')),
            start: parseDate(childText(node, 'Start')),
            finish: parseDate(childText(node, 'Finish')),
            wbs: childText(node, 'WBS'),
            outlineLevel,
            isSummary,
            predLinks,
        });
    }

    if (rawTasks.length === 0)
        throw new Error('El XML no contiene tareas válidas.');

    // ── Segunda pasada: construir jerarquía parent_id ─────────────────────────
    // Usamos una pila por nivel: stack[level] = id de la última tarea de ese nivel
    const uidToTempId = new Map<number, number>();
    let tempId = -1; // IDs negativos = temporales (no guardados aún)

    // Asignar temp IDs
    for (const r of rawTasks) {
        uidToTempId.set(r.uid, tempId--);
    }
    const rawTaskByUid = new Map(rawTasks.map((task) => [task.uid, task]));

    // Construir parent_id con stack de niveles
    const levelStack: Array<{ level: number; tempId: number }> = [];
    const ganttTasks: GanttTask[] = [];

    for (const r of rawTasks) {
        const myTempId = uidToTempId.get(r.uid)!;

        // Encontrar el padre: el último elemento en el stack con level < r.outlineLevel
        while (
            levelStack.length > 0 &&
            levelStack[levelStack.length - 1].level >= r.outlineLevel
        ) {
            levelStack.pop();
        }
        const parentTempId =
            levelStack.length > 0
                ? levelStack[levelStack.length - 1].tempId
                : null;

        // Agregar al stack
        levelStack.push({ level: r.outlineLevel, tempId: myTempId });

        // Convertir predLinks de UID → item_order (usaremos el ID secuencial de MSP como item_order)
        // En MSP, el "ID" visible en la columna N° ES el item_order equivalente
        const predecesoras: Predecessor[] = r.predLinks
            .map((link) => {
                const tipo = (LINK_TYPE_MAP[link.type] ??
                    'FC') as PredecessorType;
                // Buscamos el raw task con ese uid para obtener su ID (= item_order)
                const predRaw = rawTaskByUid.get(link.uid);
                if (!predRaw) return null;
                return {
                    taskId: predRaw.id,
                    tipo,
                    lag: link.lag,
                } as Predecessor;
            })
            .filter((p): p is Predecessor => p !== null);

        ganttTasks.push({
            id: myTempId,
            parent_id: parentTempId,
            nivel: r.outlineLevel,
            item_order: r.id, // El ID secuencial de MSP = N° de fila
            partida: r.wbs,
            descripcion: r.name,
            duracion_dias: r.duration,
            fecha_inicio: r.start,
            fecha_fin: r.finish,
            avance: 0,
            predecesoras,
            presupuesto: 0,
        });
    }

    return ganttTasks;
}
