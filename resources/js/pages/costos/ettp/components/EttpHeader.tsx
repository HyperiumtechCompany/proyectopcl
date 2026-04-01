import React from 'react';

interface Props {
    onToggleMetrados: () => void;
    onSave: () => void;
    onShowWordModal: () => void;
    onToggleExpand: () => void;
    isExpanded: boolean;
    saving?: boolean;
}

const EttpHeader: React.FC<Props> = ({ onToggleMetrados, onSave, onShowWordModal, onToggleExpand, isExpanded, saving }) => {
    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center flex-wrap gap-3">
                <h1 className="text-gray-800 dark:text-white font-bold text-lg">ESPECIFICACIONES TÉCNICAS</h1>
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                    <button
                        onClick={onToggleExpand}
                        className="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-md text-sm font-medium transition border border-indigo-200 dark:border-indigo-800"
                    >
                        {isExpanded ? '🔽 Contraer Todo' : '▶️ Expandir Todo'}
                    </button>
                    <button
                        onClick={onToggleMetrados}
                        className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition"
                    >
                        📊 Cargar Metrados
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            saving
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                    >
                        {saving ? '⏳ Guardando...' : '💾 Guardar'}
                    </button>
                    <button
                        onClick={onShowWordModal}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                    >
                        📄 Generar Word
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EttpHeader;
