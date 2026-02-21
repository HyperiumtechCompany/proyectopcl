import React from 'react';

const RedesInteriores = ({ initialData, canEdit, editMode, onChange }) => {
    return (
        <div className="max-w-full mx-auto p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-lg sticky top-12 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl shadow-lg">
                            <i className="fas fa-home text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">8. REDES INTERIORES GRADES</h1>
                            <p className="text-sm text-slate-600">Cálculo de redes interiores grades</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-full mx-auto px-2 py-4">
                <section className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4">Módulo de Redes Interiores Grades</h2>
                    <p className="text-slate-600">Funcionalidad de cálculo de redes interiores próximamente...</p>
                </section>
            </main>
        </div>
    );
};

export default RedesInteriores;