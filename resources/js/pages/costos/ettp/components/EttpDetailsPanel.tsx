import axios from 'axios';
import React from 'react';
import type { Section } from './types';

interface Props {
    show: boolean;
    currentData: any;
    sections: Section[];
    onSectionsChange: (sections: Section[]) => void;
    onClose: () => void;
    onSave: () => void;
    showNotification: (type: 'success' | 'error' | 'warning', msg: string) => void;
    proyectoId?: number;
}

const EttpDetailsPanel: React.FC<Props> = ({
    show,
    currentData,
    sections,
    onSectionsChange,
    onClose,
    onSave,
    showNotification,
    proyectoId,
}) => {
    // Si no hay proyectoId, algunas acciones de API fallarán, pero permitimos renderizar
    if (!show || !currentData) return null;

    /** Insertar imagen en una sección via file input o upload al servidor */
    const insertImage = (sectionIdx: number) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            // 👇 SIEMPRE USAR BASE64 (ignorar subida al servidor)
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgHtml = `<img src="${event.target?.result}" style="max-width: 100%; width: 300px; height: auto; margin: 10px auto; display: block; border-radius: 4px;" />`;
                const updated = [...sections];
                updated[sectionIdx] = { ...updated[sectionIdx], content: updated[sectionIdx].content + imgHtml };
                onSectionsChange(updated);
                showNotification('success', 'Imagen insertada correctamente');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    /** Inserta imagen como base64 en el contenido HTML */
    //const insertImageAsBase64 = (file: File, sectionIdx: number) => {
      //  const reader = new FileReader();
        //reader.onload = (event) => {
          //  const imgHtml = `<img src="${event.target?.result}" style="max-width: 100%; width: 400px; height: auto; margin: 10px auto; display: block; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />`;
            //const updated = [...sections];
            //updated[sectionIdx] = { ...updated[sectionIdx], content: updated[sectionIdx].content + imgHtml };
            //onSectionsChange(updated);
            //showNotification('success', 'Imagen insertada correctamente');
        //};
        //reader.onerror = () => {
          //  showNotification('error', 'Error al cargar la imagen');
        //};
        //reader.readAsDataURL(file);
    //};

    /** Eliminar una sección */
    const removeSection = async (idx: number) => {
        if (sections.length <= 1) {
            showNotification('warning', 'Debe mantener al menos una sección');
            return;
        }

        const seccion = sections[idx];

        // Si tiene ID, eliminar del servidor también
        if (seccion.id) {
            try {
                await axios.delete(`/costos/${proyectoId}/ettp/seccion/${seccion.id}`);
            } catch (err) {
                console.error('[Sección] Error eliminando:', err);
            }
        }

        onSectionsChange(sections.filter((_, i) => i !== idx));
    };

    /** Agregar nueva sección */
    const addSection = (title: string) => {
        if (!title.trim()) return;
        onSectionsChange([...sections, { title: title.trim(), content: '', orden: sections.length }]);
    };

    return (
        <div className="w-2/3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors duration-200">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 text-white p-4">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <p className="text-xs uppercase tracking-wide opacity-80">Detalles Técnicos</p>
                        <h3 className="text-sm font-bold mt-1 truncate">
                            {currentData.item} — {currentData.descripcion}
                        </h3>
                        {currentData.huerfano && (
                            <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded mt-1 inline-block">
                                ⚠️ Huérfana
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-200 text-2xl leading-none ml-2"
                    >
                        &times;
                    </button>
                </div>
            </div>

            {/* Secciones editables */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                {sections.map((section, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden shadow-sm transition-colors duration-200">
                        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center transition-colors duration-200">
                            <h4 className="font-bold text-blue-600 dark:text-blue-400 text-sm uppercase tracking-wide">
                                {section.title}
                            </h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => insertImage(idx)}
                                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                                    title="Insertar imagen">
                                    🖼️ Imagen
                                </button>
                                <button
                                    onClick={() => removeSection(idx)}
                                    className="text-red-500 hover:text-red-700 text-xs font-medium">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                                const updated = [...sections];
                                updated[idx] = { ...updated[idx], content: e.currentTarget.innerHTML };
                                onSectionsChange(updated);
                            }}
                            className="w-full p-4 text-sm focus:outline-none min-h-[150px] text-gray-800 dark:text-gray-200"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                    </div>
                ))}

                {/* Agregar nueva sección */}
                <div className="mt-4 flex gap-2">
                    <input
                        type="text"
                        id="newSectionPanel"
                        placeholder="Nombre de nueva sección"
                        className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors duration-200"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                addSection(e.currentTarget.value);
                                e.currentTarget.value = '';
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            const input = document.getElementById('newSectionPanel') as HTMLInputElement;
                            if (input?.value.trim()) {
                                addSection(input.value);
                                input.value = '';
                            }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                        Agregar
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 flex justify-end gap-2 transition-colors duration-200">
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                    Cancelar
                </button>
                <button
                    onClick={onSave}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                >
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
};

export default EttpDetailsPanel;
