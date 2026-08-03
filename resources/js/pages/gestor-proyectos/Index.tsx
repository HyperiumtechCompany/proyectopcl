import { Head, router } from '@inertiajs/react';
import { FolderKanban, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Proyecto {
    id: number;
    nombre: string;
    descripcion: string | null;
    numero_expediente: string | null;
    responsable: string | null;
    cantidad_modulos: number | null;
    monto_designado: number | null;
    tiempo_estimado_dias: number | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    nodos_count: number;
    created_at: string;
    updated_at: string;
}

interface ProyectoFormValues {
    [key: string]: string | number | null;
    nombre: string;
    descripcion: string;
    numero_expediente: string | null;
    responsable: string | null;
    cantidad_modulos: number | null;
    monto_designado: number | null;
    tiempo_estimado_dias: number | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

interface PageProps {
    proyectos: Proyecto[];
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Gestor de Proyectos', href: '/gestor-proyectos' }];

const gestorProyectoUrl = (id?: number) => (id === undefined ? '/gestor-proyectos' : `/gestor-proyectos/${id}`);

const swalDark = {
    background: '#101218',
    color: '#e4e4e7',
};

function readInput(id: string): string {
    return (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
}

function toNullableInt(raw: string): number | null {
    if (!raw) {
        return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function toNullableFloat(raw: string): number | null {
    if (!raw) {
        return null;
    }

    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
}

async function promptProyecto(initial?: Partial<ProyectoFormValues>) {
    const halfInput = 'swal2-input !w-[calc(50%-6px)] !inline-block !my-1';

    const { value } = await Swal.fire({
        title: initial ? 'Editar proyecto' : 'Nuevo proyecto',
        width: 560,
        html:
            `<input id="swal-nombre" class="swal2-input" placeholder="Nombre del proyecto" value="${initial?.nombre ?? ''}">` +
            `<textarea id="swal-descripcion" class="swal2-textarea" placeholder="Descripcion (opcional)">${initial?.descripcion ?? ''}</textarea>` +
            `<input id="swal-numero-expediente" class="${halfInput}" placeholder="N° de expediente" value="${initial?.numero_expediente ?? ''}">` +
            `<input id="swal-responsable" class="${halfInput}" placeholder="Responsable / encargado" value="${initial?.responsable ?? ''}">` +
            `<input id="swal-cantidad-modulos" type="number" min="0" class="${halfInput}" placeholder="Cantidad de modulos" value="${initial?.cantidad_modulos ?? ''}">` +
            `<input id="swal-monto-designado" type="number" min="0" step="0.01" class="${halfInput}" placeholder="Monto designado (S/)" value="${initial?.monto_designado ?? ''}">` +
            `<input id="swal-tiempo-estimado" type="number" min="0" class="${halfInput}" placeholder="Tiempo estimado (dias)" value="${initial?.tiempo_estimado_dias ?? ''}">` +
            `<input id="swal-fecha-inicio" type="date" class="${halfInput}" placeholder="Fecha de inicio" value="${initial?.fecha_inicio ?? ''}">` +
            `<input id="swal-fecha-fin" type="date" class="${halfInput}" placeholder="Fecha de fin estimada" value="${initial?.fecha_fin ?? ''}">`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: initial ? 'Guardar' : 'Crear',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        ...swalDark,
        preConfirm: () => {
            const nombre = readInput('swal-nombre');
            const descripcion = readInput('swal-descripcion');
            const fechaInicio = readInput('swal-fecha-inicio');
            const fechaFin = readInput('swal-fecha-fin');

            if (!nombre) {
                Swal.showValidationMessage('El nombre es obligatorio');
                return;
            }

            if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
                Swal.showValidationMessage('La fecha de fin no puede ser anterior a la fecha de inicio');
                return;
            }

            const values: ProyectoFormValues = {
                nombre,
                descripcion,
                numero_expediente: readInput('swal-numero-expediente') || null,
                responsable: readInput('swal-responsable') || null,
                cantidad_modulos: toNullableInt(readInput('swal-cantidad-modulos')),
                monto_designado: toNullableFloat(readInput('swal-monto-designado')),
                tiempo_estimado_dias: toNullableInt(readInput('swal-tiempo-estimado')),
                fecha_inicio: fechaInicio || null,
                fecha_fin: fechaFin || null,
            };

            return values;
        },
    });

    return value as ProyectoFormValues | undefined;
}

export default function GestorProyectosIndex({ proyectos }: PageProps) {
    const [search, setSearch] = useState('');

    const filtered = proyectos.filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase()));

    const handleCreate = async () => {
        const values = await promptProyecto();
        if (!values) {
            return;
        }

        router.post(gestorProyectoUrl(), values);
    };

    const handleRename = async (proyecto: Proyecto) => {
        const values = await promptProyecto({
            nombre: proyecto.nombre,
            descripcion: proyecto.descripcion ?? '',
            numero_expediente: proyecto.numero_expediente,
            responsable: proyecto.responsable,
            cantidad_modulos: proyecto.cantidad_modulos,
            monto_designado: proyecto.monto_designado,
            tiempo_estimado_dias: proyecto.tiempo_estimado_dias,
            fecha_inicio: proyecto.fecha_inicio,
            fecha_fin: proyecto.fecha_fin,
        });
        if (!values) {
            return;
        }

        router.patch(gestorProyectoUrl(proyecto.id), values);
    };

    const handleDelete = async (proyecto: Proyecto) => {
        const result = await Swal.fire({
            title: 'Eliminar proyecto?',
            html: `<p class="text-sm text-zinc-400">Se eliminara <strong>${proyecto.nombre}</strong> y todo su mapa de nodos.<br/>Esta accion no se puede deshacer.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            ...swalDark,
        });

        if (result.isConfirmed) {
            router.delete(gestorProyectoUrl(proyecto.id));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestor de Proyectos" />

            <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
                <div className="mx-auto w-full max-w-8xl">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/40">
                                <FolderKanban className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Gestor de Proyectos</h1>
                                <p className="text-sm text-zinc-400">Mapas de flujo de trabajo por proyecto</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/30 transition hover:bg-blue-500 active:scale-[0.97]">
                            <Plus className="h-4 w-4" />
                            Nuevo proyecto
                        </button>
                    </div>

                    {proyectos.length > 0 && (
                        <div className="relative mb-5 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar proyecto..."
                                className="w-full rounded-lg border border-white/10 bg-[#101218] py-2.5 pl-9 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                            />
                        </div>
                    )}

                    {proyectos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#101218] py-16 text-center">
                            <FolderKanban className="mb-3 h-10 w-10 text-zinc-600" />
                            <p className="text-sm font-medium text-zinc-300">Aun no tienes proyectos</p>
                            <p className="mt-1 text-xs text-zinc-500">Crea tu primer proyecto para empezar a mapear su flujo de trabajo.</p>
                            <button onClick={handleCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                                <Plus className="h-4 w-4" />
                                Crear proyecto
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                            {filtered.map((proyecto) => (
                                <div
                                    key={proyecto.id}
                                    onClick={() => router.get(gestorProyectoUrl(proyecto.id))}
                                    className="group relative cursor-pointer rounded-xl border border-white/10 bg-[#101218] p-4 shadow-sm transition-colors hover:border-white/25">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <h3 className="truncate text-sm font-semibold text-zinc-100">{proyecto.nombre}</h3>
                                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleRename(proyecto);
                                                }}
                                                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                                                aria-label="Renombrar proyecto">
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleDelete(proyecto);
                                                }}
                                                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-rose-400"
                                                aria-label="Eliminar proyecto">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mb-3 line-clamp-2 min-h-8 text-xs text-zinc-500">{proyecto.descripcion || 'Sin descripcion'}</p>

                                    {(proyecto.numero_expediente || proyecto.monto_designado !== null || proyecto.tiempo_estimado_dias !== null) && (
                                        <div className="mb-2 flex flex-wrap items-center gap-1">
                                            {proyecto.numero_expediente && (
                                                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">Exp. {proyecto.numero_expediente}</span>
                                            )}
                                            {proyecto.monto_designado !== null && (
                                                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-emerald-400">{currencyFormatter.format(proyecto.monto_designado)}</span>
                                            )}
                                            {proyecto.tiempo_estimado_dias !== null && (
                                                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">{proyecto.tiempo_estimado_dias} dias</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                                        <span className="shrink-0 whitespace-nowrap">{proyecto.nodos_count} nodos</span>
                                        <span className="truncate whitespace-nowrap">Actualizado {proyecto.updated_at}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
