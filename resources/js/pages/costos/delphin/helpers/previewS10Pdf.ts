import Decimal from 'decimal.js';
import axios from 'axios';
import { previewPdf } from '@/actions/App/Http/Controllers/PresupuestoController';
import { detectAcuFileKind } from './detectAcuFile';
import { calculateAcuLocally } from '../../presupuesto/hooks/usePresupuestoAcu';
import type { DelphinRow } from '../types';
import type { ParsedAcu, ParsedAcuComponente } from './parseAcuExcel';
import { matchAcuToPartida, type AcuMatch } from './matchAcuToPartida';

export const PDF_COMPONENT_SECTIONS = [
    'mano_de_obra',
    'materiales',
    'equipos',
    'subcontratos',
    'subpartidas',
] as const;
type Section = (typeof PDF_COMPONENT_SECTIONS)[number];
type SourceComponent = Omit<ParsedAcuComponente, 'recursos'> & {
    recursos: number | null;
    reported_partial: number;
    page: number;
};
export type S10PdfAnalysis = Omit<ParsedAcu, Section | 'rendimiento'> &
    Record<Section, SourceComponent[]> & {
        kind: 'main' | 'auxiliary';
        rendimiento: number | null;
        rendimiento_text: string;
        declared_cost: number | null;
        page: number;
    };
export type S10PdfIssue = {
    kind: string;
    code: string | null;
    page: number | null;
    message: string;
};
export type S10PdfDocument = {
    pages: number;
    empty_pages: number[];
    analyses: S10PdfAnalysis[];
    issues: S10PdfIssue[];
};
export type S10PdfPreviewEntry = {
    source: S10PdfAnalysis;
    match: AcuMatch;
    calculatedCost: number;
    reasons: string[];
    warnings: string[];
};
export type S10PdfPreview = {
    pages: number;
    auxiliaryCount: number;
    issues: S10PdfIssue[];
    entries: S10PdfPreviewEntry[];
    applicableMatches: AcuMatch[];
};

const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;
const finite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

export function isS10PdfDocument(value: unknown): value is S10PdfDocument {
    if (
        !record(value) ||
        !finite(value.pages) ||
        value.pages < 1 ||
        !Array.isArray(value.empty_pages) ||
        !value.empty_pages.every(finite) ||
        !Array.isArray(value.issues) ||
        !Array.isArray(value.analyses)
    )
        return false;
    if (
        !value.issues.every(
            (issue: unknown) =>
                record(issue) &&
                typeof issue.kind === 'string' &&
                (issue.code === null || typeof issue.code === 'string') &&
                (issue.page === null || finite(issue.page)) &&
                typeof issue.message === 'string',
        )
    )
        return false;
    return value.analyses.every(
        (analysis: unknown) =>
            record(analysis) &&
            ['main', 'auxiliary'].includes(String(analysis.kind)) &&
            typeof analysis.partida_code === 'string' &&
            typeof analysis.partida_desc === 'string' &&
            typeof analysis.unidad === 'string' &&
            finite(analysis.page) &&
            typeof analysis.rendimiento_text === 'string' &&
            (analysis.rendimiento === null || finite(analysis.rendimiento)) &&
            (analysis.declared_cost === null ||
                finite(analysis.declared_cost)) &&
            PDF_COMPONENT_SECTIONS.every(
                (section) =>
                    Array.isArray(analysis[section]) &&
                    analysis[section].every(
                        (component: unknown) =>
                            record(component) &&
                            typeof component.descripcion === 'string' &&
                            typeof component.unidad === 'string' &&
                            (component.codigo === null ||
                                typeof component.codigo === 'string') &&
                            (component.proveedor === null ||
                                typeof component.proveedor === 'string') &&
                            (component.recursos === null ||
                                finite(component.recursos)) &&
                            [
                                'cantidad',
                                'precio_unitario',
                                'precio_hora',
                                'factor_desperdicio',
                                'reported_partial',
                                'page',
                            ].every((key) => finite(component[key])),
                    ),
            ),
    );
}

export function localS10PdfEndpoint(moduleUrl = import.meta.url): string {
    const url = new URL(moduleUrl);
    return `${url.origin}/__s10-pdf-lab`;
}

export async function readLocalS10Pdf(
    file: File,
    signal?: AbortSignal,
    projectId = 0,
): Promise<S10PdfDocument> {
    if (!import.meta.env.DEV && projectId <= 0)
        throw new Error(
            'La prueba PDF requiere iniciar npm run dev y recargar el presupuesto.',
        );
    if ((await detectAcuFileKind(file)) !== 'pdf')
        throw new Error('Selecciona un archivo PDF.');
    if (file.size > 20 * 1024 * 1024)
        throw new Error('El PDF supera el límite local de 20 MB.');
    let data: unknown;
    if (projectId > 0) {
        const response = await axios.post(previewPdf.url(projectId), file, {
            headers: {
                'Content-Type': 'application/pdf',
                Accept: 'application/json',
            },
            signal,
        });
        data = response.data;
    } else {
        let response: Response;
        try {
            response = await fetch(localS10PdfEndpoint(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/pdf' },
                body: file,
                signal,
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw new Error(
                'No se pudo conectar al lector local. Inicia npm run dev, recarga el presupuesto y vuelve a seleccionar el PDF.',
            );
        }
        data = await response.json();
        if (!response.ok)
            throw new Error(
                record(data) && typeof data.error === 'string'
                    ? data.error
                    : 'No se pudo leer el PDF.',
            );
    }
    if (!isS10PdfDocument(data))
        throw new Error(
            'El lector local devolvió datos incompletos. No se cargó ningún ACU.',
        );
    if (!data.analyses.some((analysis) => analysis.kind === 'main'))
        throw new Error(
            'No se encontraron ACU principales en el PDF. Verifica el reporte seleccionado; no se cargó ningún dato.',
        );
    return data;
}

const canonical = (value: string) =>
    value
        .split('.')
        .map((part) => String(Number(part)))
        .join('.');
const normalizeUnit = (value: string) =>
    value.trim().toLowerCase().replaceAll('²', '2').replaceAll('³', '3');

export function previewS10Pdf(
    document: S10PdfDocument,
    rows: DelphinRow[],
): S10PdfPreview {
    const sources = document.analyses.filter(
        (analysis) => analysis.kind === 'main',
    );
    const parentIds = new Set(
        rows.map((row) => row.parent_id).filter((id) => id != null),
    );
    const leaves = rows.filter(
        (row) => !parentIds.has(row.id) && row.unidad.trim(),
    );
    const components = (
        values: SourceComponent[],
        source: S10PdfAnalysis,
        section: Section,
    ): ParsedAcuComponente[] =>
        values.map((component) => ({
            ...component,
            unidad: component.unidad.trim() || 'und',
            recursos: component.recursos ?? 0,
            source_pdf: {
                format: 's10_pdf',
                quantity: component.cantidad,
                price:
                    section === 'equipos'
                        ? component.precio_hora
                        : component.precio_unitario,
                partial: component.reported_partial,
                unit: component.unidad.trim() || 'und',
                original_unit: component.unidad,
                description: component.descripcion,
                code: component.codigo,
                resources:
                    section === 'mano_de_obra' || section === 'equipos'
                        ? (component.recursos ?? 0)
                        : 0,
                factor: component.factor_desperdicio ?? 1,
                rendimiento:
                    source.rendimiento && source.rendimiento > 0
                        ? source.rendimiento
                        : 1,
                original_rendimiento: source.rendimiento,
                declared_cost: source.declared_cost ?? 0,
                page: component.page,
            },
        }));
    const acus = sources.map((source): ParsedAcu => ({
        ...source,
        // El modelo requiere un valor positivo. Se conserva la ausencia original
        // en source_pdf y se advierte en la revisión; no se infieren cuadrillas.
        rendimiento:
            source.rendimiento && source.rendimiento > 0
                ? source.rendimiento
                : 1,
        mano_de_obra: components(source.mano_de_obra, source, 'mano_de_obra'),
        materiales: components(source.materiales, source, 'materiales'),
        equipos: components(source.equipos, source, 'equipos'),
        subcontratos: components(source.subcontratos, source, 'subcontratos'),
        subpartidas: components(source.subpartidas, source, 'subpartidas'),
    }));
    const matches = matchAcuToPartida(acus, leaves);
    const targetCounts = new Map<string, number>();
    for (const row of leaves) {
        const key = canonical(row.partida);
        targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
    }
    const matchCounts = new Map<number, number>();
    for (const match of matches)
        if (match.row)
            matchCounts.set(
                match.row.id,
                (matchCounts.get(match.row.id) ?? 0) + 1,
            );
    const entries = matches.map((match, index): S10PdfPreviewEntry => {
        const source = sources[index];
        const reasons: string[] = [];
        const warnings: string[] = [];
        const calculatedCost = calculateAcuLocally(match.acu)
            .costo_unitario_total as number;
        if (!match.row)
            reasons.push('Sin partida vinculada en este presupuesto.');
        if (
            match.row &&
            ((targetCounts.get(canonical(match.row.partida)) ?? 0) > 1 ||
                (matchCounts.get(match.row.id) ?? 0) > 1)
        )
            reasons.push(
                'Más de un ACU o partida corresponde al mismo destino.',
            );
        if (
            document.empty_pages.length > 0 ||
            document.issues.some((issue) => issue.code === null)
        )
            reasons.push(
                'El documento contiene páginas o bloques sin leer completamente.',
            );
        const sourceIssues = document.issues.filter(
            (issue) => issue.code === source.partida_code,
        );
        if (
            sourceIssues.some(
                (issue) =>
                    !['missing_unit', 'component_partial_difference'].includes(
                        issue.kind,
                    ),
            )
        )
            reasons.push('Revisar observaciones de lectura de esta partida.');
        warnings.push(...sourceIssues.map((issue) => issue.message));
        if (source.rendimiento === null || source.rendimiento <= 0)
            warnings.push(
                'Rendimiento no declarado en el PDF; se registra 1 como valor técnico, conservando la ausencia original.',
            );
        if (!source.unidad.trim())
            reasons.push('El PDF no declara la unidad del ACU.');
        else if (
            match.row &&
            normalizeUnit(source.unidad) !== normalizeUnit(match.row.unidad)
        )
            warnings.push(
                `Unidad PDF: ${source.unidad}; unidad Excel: ${match.row.unidad}. Se conservan ambas sin convertir cantidades.`,
            );
        const components = PDF_COMPONENT_SECTIONS.flatMap(
            (section) => source[section],
        );
        if (components.length === 0) reasons.push('Faltan componentes.');
        if (components.some((component) => !component.unidad.trim()))
            warnings.push(
                'Hay recursos sin unidad declarada; se registra und y se conserva el dato original vacío.',
            );
        if (
            source.declared_cost === null ||
            !Number.isFinite(calculatedCost) ||
            !new Decimal(calculatedCost).equals(source.declared_cost)
        )
            reasons.push(
                'Los parciales leídos no concilian con el costo declarado del PDF.',
            );
        if (
            match.row &&
            (source.declared_cost === null ||
                !new Decimal(match.row.precio_unitario).equals(
                    source.declared_cost,
                ))
        )
            warnings.push(
                'El precio del presupuesto difiere del costo PDF; se conservará el precio del presupuesto.',
            );
        return { source, match, calculatedCost, reasons, warnings };
    });
    return {
        pages: document.pages,
        auxiliaryCount: document.analyses.length - sources.length,
        issues: document.issues,
        entries,
        applicableMatches: entries
            .filter((entry) => entry.reasons.length === 0)
            .map((entry) => entry.match),
    };
}
