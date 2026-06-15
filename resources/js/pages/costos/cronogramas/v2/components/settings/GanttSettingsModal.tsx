import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, X } from 'lucide-react';
import type {
    GanttCalendarSettings,
    GanttHoliday,
    WeekdayKey,
} from '../../types/calendar';
import {
    createCalendarId,
    normalizeCalendarSettings,
    WEEKDAYS,
} from '../../types/calendar';
import dayjs from 'dayjs';
import { diffInclusiveDays } from '../../utils/date';

interface Props {
    open: boolean;
    settings: GanttCalendarSettings;
    onClose: () => void;
    onSave: (settings: GanttCalendarSettings) => void;
}

function newHoliday(): GanttHoliday {
    return {
        id: createCalendarId(),
        date: '',
        name: '',
    };
}

export function GanttSettingsModal({ open, settings, onClose, onSave }: Props) {
    const [draft, setDraft] = useState<GanttCalendarSettings>(settings);

    useEffect(() => {
        if (open) {
            setDraft(settings);
        }
    }, [open, settings]);

    if (!open) return null;

    const updateWorkDay = (
        key: WeekdayKey,
        field: 'enabled' | 'start' | 'end',
        value: boolean | string,
    ) => {
        setDraft((prev) => ({
            ...prev,
            workDays: {
                ...prev.workDays,
                [key]: {
                    ...prev.workDays[key],
                    [field]: value,
                },
            },
        }));
    };

    const updateHoliday = (
        id: string,
        field: keyof Pick<GanttHoliday, 'date' | 'name'>,
        value: string,
    ) => {
        setDraft((prev) => ({
            ...prev,
            holidays: prev.holidays.map((holiday) =>
                holiday.id === id ? { ...holiday, [field]: value } : holiday,
            ),
        }));
    };

    const removeHoliday = (id: string) => {
        setDraft((prev) => ({
            ...prev,
            holidays: prev.holidays.filter((holiday) => holiday.id !== id),
        }));
    };

    const handleSave = () => {
        onSave(normalizeCalendarSettings(draft, settings));
        onClose();
    };

    const projectDuration = diffInclusiveDays(draft.projectStart, draft.projectEnd) || 0;

    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const days = parseInt(e.target.value, 10);
        if (!isNaN(days) && days > 0 && draft.projectStart) {
            const newEnd = dayjs(draft.projectStart).add(days - 1, 'day').format('YYYY-MM-DD');
            setDraft((prev) => ({
                ...prev,
                projectEnd: newEnd,
            }));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
            <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl shadow-black/50">
                <div className="flex h-12 items-center justify-between border-b border-slate-700 px-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock size={17} className="text-blue-300" />
                        Configuracion del cronograma
                    </div>
                    <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[calc(88vh-104px)] overflow-y-auto px-4 py-4">
                    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
                                Rango del proyecto
                            </h3>
                            <label className="block text-xs text-slate-400">
                                Fecha de inicio
                                <input
                                    type="date"
                                    value={draft.projectStart}
                                    onChange={(event) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            projectStart: event.target.value,
                                        }))
                                    }
                                    className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                                />
                            </label>
                            <label className="block text-xs text-slate-400">
                                Duración (días)
                                <input
                                    type="number"
                                    min={1}
                                    value={projectDuration > 0 ? projectDuration : ''}
                                    onChange={handleDurationChange}
                                    className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                                    placeholder="Calcular fin..."
                                />
                            </label>
                            <label className="block text-xs text-slate-400">
                                Fecha de termino
                                <input
                                    type="date"
                                    value={draft.projectEnd}
                                    onChange={(event) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            projectEnd: event.target.value,
                                        }))
                                    }
                                    className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                                />
                            </label>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
                                Dias laborables y horarios
                            </h3>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {WEEKDAYS.map((day) => {
                                    const config = draft.workDays[day.key];
                                    return (
                                        <div
                                            key={day.key}
                                            className="rounded border border-slate-700 bg-slate-950/60 p-3"
                                        >
                                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                                                <input
                                                    type="checkbox"
                                                    checked={config.enabled}
                                                    onChange={(event) =>
                                                        updateWorkDay(
                                                            day.key,
                                                            'enabled',
                                                            event.target
                                                                .checked,
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                                                />
                                                {day.label}
                                            </label>
                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                <label className="text-[11px] text-slate-500">
                                                    Inicio
                                                    <input
                                                        type="time"
                                                        value={config.start}
                                                        disabled={
                                                            !config.enabled
                                                        }
                                                        onChange={(event) =>
                                                            updateWorkDay(
                                                                day.key,
                                                                'start',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none disabled:opacity-40"
                                                    />
                                                </label>
                                                <label className="text-[11px] text-slate-500">
                                                    Fin
                                                    <input
                                                        type="time"
                                                        value={config.end}
                                                        disabled={
                                                            !config.enabled
                                                        }
                                                        onChange={(event) =>
                                                            updateWorkDay(
                                                                day.key,
                                                                'end',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none disabled:opacity-40"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    <section className="mt-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
                                Festividades
                            </h3>
                            <button
                                type="button"
                                className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600"
                                onClick={() =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        holidays: [
                                            ...prev.holidays,
                                            newHoliday(),
                                        ],
                                    }))
                                }
                            >
                                <Plus size={13} />
                                Agregar
                            </button>
                        </div>

                        <div className="space-y-2">
                            {draft.holidays.length === 0 && (
                                <div className="rounded border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
                                    Sin festividades configuradas
                                </div>
                            )}

                            {draft.holidays.map((holiday) => (
                                <div
                                    key={holiday.id}
                                    className="grid gap-2 rounded border border-slate-700 bg-slate-950/60 p-2 sm:grid-cols-[160px_1fr_auto]"
                                >
                                    <input
                                        type="date"
                                        value={holiday.date}
                                        onChange={(event) =>
                                            updateHoliday(
                                                holiday.id,
                                                'date',
                                                event.target.value,
                                            )
                                        }
                                        className="h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={holiday.name}
                                        placeholder="Nombre de la festividad"
                                        onChange={(event) =>
                                            updateHoliday(
                                                holiday.id,
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                        className="h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
                                    />
                                    <button
                                        type="button"
                                        className="flex h-8 items-center justify-center rounded bg-red-900/50 px-2 text-red-200 hover:bg-red-800"
                                        onClick={() =>
                                            removeHoliday(holiday.id)
                                        }
                                        aria-label="Eliminar festividad"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="flex h-14 justify-end gap-2 border-t border-slate-700 px-4 py-3">
                    <button
                        type="button"
                        className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                        onClick={handleSave}
                    >
                        Aplicar configuracion
                    </button>
                </div>
            </div>
        </div>
    );
}
