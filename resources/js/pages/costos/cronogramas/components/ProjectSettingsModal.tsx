import React, { useState } from 'react';
import { gantt } from 'dhtmlx-gantt';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onApply: (settings: any) => void;
}

export const ProjectSettingsModal = ({ isOpen, onClose, onApply }: Props) => {
    const [topUnit, setTopUnit] = useState('month');
    const [bottomUnit, setBottomUnit] = useState('day');
    const [workStartTime, setWorkStartTime] = useState('08:00');
    const [workEndTime, setWorkEndTime] = useState('17:00');
    const [projectStart, setProjectStart] = useState('');
    const [projectEnd, setProjectEnd] = useState('');
    const [scheduleFromEnd, setScheduleFromEnd] = useState(false);
    const [workDays, setWorkDays] = useState({
        lunes: true, martes: true, miercoles: true,
        jueves: true, viernes: true, sabado: false, domingo: false,
    });

    const aplicarAjustes = () => {
        // Escala de tiempo
        gantt.config.scales = [
            { unit: topUnit as any, step: 1, format: topUnit === 'year' ? '%Y' : '%F, %Y' },
            { unit: bottomUnit as any, step: 1, format: bottomUnit === 'day' ? '%j %D' : 'Sem %W' },
        ];

        // Días laborables
        const dayMap: Record<string, number> = {
            domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
        };

        for (let i = 0; i <= 6; i++) {
            gantt.setWorkTime({ day: i, hours: false });
        }

        Object.entries(workDays).forEach(([name, active]) => {
            if (active) {
                gantt.setWorkTime({
                    day: dayMap[name],
                    hours: [`${workStartTime}-${workEndTime}`],
                });
            }
        });

        // Fechas del proyecto
        if (projectStart) gantt.config.start_date = new Date(projectStart);
        if (projectEnd) gantt.config.end_date = new Date(projectEnd);
        gantt.config.schedule_from_end = scheduleFromEnd;
        gantt.config.skip_off_time = true;
        gantt.render();

        if (projectStart) {
            setTimeout(() => gantt.showDate(new Date(projectStart)), 100);
        }

        onApply({ topUnit, bottomUnit, workStartTime, workEndTime, projectStart, projectEnd, scheduleFromEnd, workDays });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="bg-gray-100 px-5 py-4 border-b flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Configuración del Proyecto</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Escala de tiempo */}
                    <section>
                        <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                            Configuración de Escala de Tiempo
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Unidad (Capa Superior)</label>
                                <select value={topUnit} onChange={(e) => setTopUnit(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                                    <option value="month">Mes (M)</option>
                                    <option value="year">Año (Y)</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Unidad (Capa Inferior)</label>
                                <select value={bottomUnit} onChange={(e) => setBottomUnit(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                                    <option value="day">Día</option>
                                    <option value="week">Semana</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Fechas del proyecto */}
                    <section>
                        <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                            Fechas del Proyecto
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Inicio del Proyecto</label>
                                <input type="date" value={projectStart}
                                    onChange={(e) => setProjectStart(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Fin Pronosticado</label>
                                <input type="date" value={projectEnd}
                                    onChange={(e) => setProjectEnd(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                            <input type="checkbox" checked={scheduleFromEnd}
                                onChange={(e) => setScheduleFromEnd(e.target.checked)}
                                className="w-4 h-4 rounded accent-blue-600" />
                            <span className="text-xs font-medium text-gray-700">Programar desde el Fin</span>
                        </label>
                    </section>

                    {/* Calendario laboral */}
                    <section>
                        <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                            Días Laborales
                        </h3>
                        <div className="grid grid-cols-4 gap-3">
                            {([
                                ['lunes', 'Lunes'],
                                ['martes', 'Martes'],
                                ['miercoles', 'Miércoles'],
                                ['jueves', 'Jueves'],
                                ['viernes', 'Viernes'],
                                ['sabado', 'Sábado'],
                                ['domingo', 'Domingo'],
                            ] as [keyof typeof workDays, string][]).map(([key, label]) => (
                                <label key={key}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium select-none ${workDays[key]
                                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                                        : 'bg-gray-50 border-gray-300 text-gray-500'
                                    }`}
                                >
                                    <input type="checkbox" checked={workDays[key]}
                                        onChange={(e) => setWorkDays((d) => ({ ...d, [key]: e.target.checked }))}
                                        className="w-3.5 h-3.5 rounded accent-blue-600" />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Jornada laboral */}
                    <section>
                        <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                            Horario Laboral
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Hora de Inicio</label>
                                <input type="time" value={workStartTime}
                                    onChange={(e) => setWorkStartTime(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Hora de Fin</label>
                                <input type="time" value={workEndTime}
                                    onChange={(e) => setWorkEndTime(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </section>
                </div>

                <div className="bg-gray-50 px-5 py-4 border-t flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-500 uppercase hover:text-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={aplicarAjustes}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-xs font-black uppercase shadow-md transition-colors">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};