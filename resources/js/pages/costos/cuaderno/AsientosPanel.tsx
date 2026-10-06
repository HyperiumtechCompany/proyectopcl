import { Link, router } from '@inertiajs/react';
import {
    ChevronDown,
    Download,
    FileText,
    Link2,
    Search,
    StickyNote,
} from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportMethod, show } from '@/routes/costos/cuaderno';
import { pdf } from '@/routes/costos/cuaderno/asientos';
import AsientoDetail, { type Asiento } from './AsientoDetail';
import DownloadCenter, { type IndexEntry } from './DownloadCenter';

export interface AsientosPage {
    data: Asiento[];
    total: number;
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

export type Filters = {
    q?: string;
    tipo?: string;
    estado?: string;
};

// Narrow screens hide secondary columns; their data stays in the expanded detail.
const COLUMNS = [
    { label: 'N.º', className: '' },
    { label: 'Título', className: '' },
    { label: 'Tipo', className: 'hidden md:table-cell' },
    { label: 'Fecha oficial', className: 'hidden sm:table-cell' },
    { label: 'Usuario / rol', className: 'hidden lg:table-cell' },
    { label: 'Estado', className: 'hidden xl:table-cell' },
];

export default function AsientosPanel({
    projectId,
    asientos,
    filters,
    tipos,
    estados,
    indice,
    canFetch,
}: {
    projectId: number;
    asientos: AsientosPage | null;
    filters: Filters;
    tipos: { valor: string; total: number }[];
    estados: string[];
    indice: IndexEntry[];
    canFetch: boolean;
}) {
    // Selected entries (ids) survive paging and searching, for downloads by selection.
    const [selected, setSelected] = useState<number[]>([]);
    const pageIds = asientos?.data.map((asiento) => asiento.id) ?? [];
    const allPageSelected =
        pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

    function toggle(id: number) {
        setSelected((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );
    }

    function togglePage() {
        setSelected((current) =>
            allPageSelected
                ? current.filter((id) => !pageIds.includes(id))
                : [...new Set([...current, ...pageIds])],
        );
    }
    const [query, setQuery] = useState(filters.q ?? '');
    const [openId, setOpenId] = useState<number | null>(null);
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasFilters = Boolean(filters.q || filters.tipo || filters.estado);

    function apply(next: Filters) {
        const params = Object.fromEntries(
            Object.entries({ ...filters, ...next }).filter(
                ([, value]) => value,
            ),
        );
        router.get(show.url(projectId), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['asientos', 'filters'],
        });
    }

    function search(value: string) {
        setQuery(value);
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => apply({ q: value }), 350);
    }

    function clear() {
        setQuery('');
        router.get(
            show.url(projectId),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['asientos', 'filters'],
            },
        );
    }

    return (
        <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">
                    Asientos{asientos ? ` (${asientos.total})` : ''}
                </h2>
                <div className="flex flex-wrap items-start gap-2">
                    {!!asientos?.total && (
                        <Button variant="outline" size="sm" asChild>
                            <a
                                href={exportMethod.url(projectId, {
                                    query: filters,
                                })}
                            >
                                <Download /> Descargar Excel (CSV)
                            </a>
                        </Button>
                    )}
                </div>
            </div>

            {indice.length > 0 && (
                <DownloadCenter
                    key={selected.length ? 'seleccion' : 'todos'}
                    projectId={projectId}
                    indice={indice}
                    selected={selected}
                    canFetch={canFetch}
                />
            )}

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-60 flex-1">
                    <Search
                        size={16}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        aria-label="Buscar por número, título, usuario o nota"
                        placeholder="Buscar por número, título, usuario o nota…"
                        value={query}
                        maxLength={120}
                        onChange={(event) => search(event.target.value)}
                        className="pl-9"
                    />
                </div>
                <select
                    aria-label="Estado"
                    value={filters.estado ?? ''}
                    onChange={(event) => apply({ estado: event.target.value })}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="">Todos los estados</option>
                    {estados.map((estado) => (
                        <option key={estado} value={estado}>
                            {estado}
                        </option>
                    ))}
                </select>
                {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clear}>
                        Limpiar
                    </Button>
                )}
            </div>

            {tipos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {tipos.map((tipo) => {
                        const active = filters.tipo === tipo.valor;
                        return (
                            <button
                                key={tipo.valor}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    apply({ tipo: active ? '' : tipo.valor })
                                }
                                className={`rounded-full border px-3 py-1 text-xs transition ${
                                    active
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'hover:bg-muted'
                                }`}
                            >
                                {tipo.valor || 'Sin tipo'}{' '}
                                <span className="opacity-70">{tipo.total}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {!asientos?.data.length ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {hasFilters
                        ? 'Ningún asiento coincide con la búsqueda.'
                        : 'Todavía no hay asientos. Conecta tu cuenta y sincroniza la bandeja.'}
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="w-8 p-2">
                                        <input
                                            type="checkbox"
                                            aria-label="Seleccionar los asientos de esta página"
                                            checked={allPageSelected}
                                            onChange={togglePage}
                                        />
                                    </th>
                                    {COLUMNS.map((column) => (
                                        <th
                                            key={column.label}
                                            className={`p-2 font-medium ${column.className}`}
                                        >
                                            {column.label}
                                        </th>
                                    ))}
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {asientos.data.map((asiento) => {
                                    const open = openId === asiento.id;
                                    const links =
                                        asiento.referencias.length +
                                        asiento.referenciado_por.length;
                                    return (
                                        <Fragment key={asiento.id}>
                                            <tr
                                                onClick={() =>
                                                    setOpenId(
                                                        open
                                                            ? null
                                                            : asiento.id,
                                                    )
                                                }
                                                className={`cursor-pointer border-b align-top hover:bg-muted/50 ${open ? 'bg-muted/50' : ''}`}
                                            >
                                                <td
                                                    className="p-2"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Seleccionar el asiento ${asiento.numero}`}
                                                        checked={selected.includes(
                                                            asiento.id,
                                                        )}
                                                        onChange={() =>
                                                            toggle(asiento.id)
                                                        }
                                                    />
                                                </td>
                                                <td className="p-2 font-medium">
                                                    {asiento.numero}
                                                </td>
                                                <td className="min-w-48 p-2">
                                                    {asiento.titulo}
                                                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                                                        {asiento.fecha_oficial}
                                                    </span>
                                                    <span className="mt-1 flex gap-2">
                                                        {links > 0 && (
                                                            <Badge variant="secondary">
                                                                <Link2 />{' '}
                                                                {links}
                                                            </Badge>
                                                        )}
                                                        {asiento.tiene_pdf && (
                                                            <a
                                                                href={pdf.url({
                                                                    costoProject:
                                                                        projectId,
                                                                    asiento:
                                                                        asiento.id,
                                                                })}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                                aria-label={`Ver PDF oficial del asiento ${asiento.numero}`}
                                                            >
                                                                <Badge variant="secondary">
                                                                    <FileText />{' '}
                                                                    PDF
                                                                </Badge>
                                                            </a>
                                                        )}
                                                        {asiento.nota_local && (
                                                            <Badge variant="secondary">
                                                                <StickyNote />{' '}
                                                                Nota
                                                            </Badge>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="hidden p-2 md:table-cell">
                                                    {asiento.tipo}
                                                </td>
                                                <td className="hidden min-w-36 p-2 sm:table-cell">
                                                    {asiento.fecha_oficial}
                                                </td>
                                                <td className="hidden p-2 lg:table-cell">
                                                    {asiento.usuario}
                                                    <br />
                                                    <span className="text-xs text-muted-foreground">
                                                        {asiento.rol}
                                                    </span>
                                                </td>
                                                <td className="hidden p-2 xl:table-cell">
                                                    {asiento.estado}
                                                </td>
                                                <td className="p-2">
                                                    <button
                                                        type="button"
                                                        aria-expanded={open}
                                                        aria-label={`Detalle del asiento ${asiento.numero}`}
                                                    >
                                                        <ChevronDown
                                                            size={16}
                                                            className={`transition ${open ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr className="border-b bg-muted/30">
                                                    <td
                                                        colSpan={
                                                            COLUMNS.length + 2
                                                        }
                                                        className="p-4"
                                                    >
                                                        <AsientoDetail
                                                            key={asiento.id}
                                                            projectId={
                                                                projectId
                                                            }
                                                            asiento={asiento}
                                                            canFetch={canFetch}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                        {asientos.prev_page_url ? (
                            <Link
                                href={asientos.prev_page_url}
                                preserveScroll
                                preserveState
                            >
                                ← Anterior
                            </Link>
                        ) : (
                            <span />
                        )}
                        <span className="text-muted-foreground">
                            Página {asientos.current_page} de{' '}
                            {asientos.last_page}
                        </span>
                        {asientos.next_page_url ? (
                            <Link
                                href={asientos.next_page_url}
                                preserveScroll
                                preserveState
                            >
                                Siguiente →
                            </Link>
                        ) : (
                            <span />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
