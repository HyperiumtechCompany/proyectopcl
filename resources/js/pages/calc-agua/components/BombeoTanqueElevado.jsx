import React from 'react';

const BombeoTanqueElevado = ({ initialData, canEdit, editMode, onChange }) => {
    return (
        <div className="max-w-full mx-auto p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-lg sticky top-12 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg">
                            <i className="fas fa-pump text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">6. BOMBEO AL TANQUE ELEVADO</h1>
                            <p className="text-sm text-slate-600">Cálculo de bombeo al tanque elevado</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-full mx-auto px-2 py-4">
                <section className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4">Módulo de Bombeo al Tanque Elevado</h2>
                    <p className="text-slate-600">Funcionalidad de cálculo de bombeo próximamente...</p>
                </section>
            </main>
        </div>
    );
};

export default BombeoTanqueElevado;