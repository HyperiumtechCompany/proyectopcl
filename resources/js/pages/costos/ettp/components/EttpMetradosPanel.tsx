import React from 'react';
import type { SelectedSections } from './types';
import { ESPECIALIDADES_CONFIG } from './types';

interface Props {
    show: boolean;
    selectedSections: SelectedSections;
    onSelectedChange: (sections: SelectedSections) => void;
    onLoadMetrados: () => void;
    loading?: boolean;
}

const EttpMetradosPanel: React.FC<Props> = ({
    show,
    selectedSections,
    onSelectedChange,
    onLoadMetrados,
    loading,
}) => {
    if (!show) return null;

    return (
        <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-b border-blue-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        📋 IMPORTAR MÉTRADOS
                    </span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {ESPECIALIDADES_CONFIG.map(({ key, label, desc }) => (
                        <label
                            key={key}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <input
                                type="checkbox"
                                checked={selectedSections[key]}
                                onChange={e =>
                                    onSelectedChange({ ...selectedSections, [key]: e.target.checked })
                                }
                                className="w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    {label}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="flex justify-end mt-5 pt-3 border-t border-blue-200 dark:border-gray-700">
                    <button
                        onClick={onLoadMetrados}
                        disabled={loading}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide shadow-md transition-all flex items-center gap-2 ${
                            loading
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white hover:shadow-lg'
                        }`}
                    >
                        <span>{loading ? '⏳' : '📥'}</span>
                        {loading ? 'Importando...' : 'Importar Metrados'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EttpMetradosPanel;
