import React from 'react';

interface Props {
    onToggleMetrados: () => void;
    onSave: () => void;
    onShowWordModal: () => void;
    saving?: boolean;
}

const EttpHeader: React.FC<Props> = ({ onToggleMetrados, onSave, onShowWordModal, saving }) => {
    return (
        <div className="bg-gray-800 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                <h1 className="text-white font-bold text-lg">ESPECIFICACIONES TÉCNICAS</h1>
                <div className="flex gap-3">
                    <button
                        onClick={onToggleMetrados}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
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
