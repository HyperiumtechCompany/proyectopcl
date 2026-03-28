import React from 'react';
import type { Section } from './types';
import axios from 'axios';

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

            const seccion = sections[sectionIdx];

            // Si la sección tiene ID (ya guardada en BD), subir al servidor
            if (seccion.id) {
                try {
                    const formData = new FormData();
                    formData.append('imagen', file);

                    const response = await axios.post(`/costos/${proyectoId}/ettp/seccion/${seccion.id}/imagen`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });

                    if (response.data?.success) {
                        const imgUrl = response.data.imagen.url;
                        const imgHtml = `<img src="${imgUrl}" style="max-width:100%; margin:10px 0; border-radius:8px;" alt="${response.data.imagen.nombre_original}" />`;
                        const updated = [...sections];
                        updated[sectionIdx] = { ...updated[sectionIdx], content: updated[sectionIdx].content + imgHtml };
                        onSectionsChange(updated);
                        showNotification('success', 'Imagen subida correctamente');
                    }
                } catch (err) {
                    console.error('[Imagen] Error subiendo:', err);
                    // Fallback: insertar como base64
                    insertImageAsBase64(file, sectionIdx);
                }
            } else {
                // Sin ID: insertar como base64 (modo offline/nuevo)
                insertImageAsBase64(file, sectionIdx);
            }
        };
        input.click();
    };

    /** Inserta imagen como base64 en el contenido HTML */
    const insertImageAsBase64 = (file: File, sectionIdx: number) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const imgHtml = `<img src="${event.target?.result}" style="max-width:100%; margin:10px 0; border-radius:8px;" />`;
            const updated = [...sections];
            updated[sectionIdx] = { ...updated[sectionIdx], content: updated[sectionIdx].content + imgHtml };
            onSectionsChange(updated);
        };
        reader.readAsDataURL(file);
    };

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
        <div className="w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
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
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {sections.map((section, idx) => (
                    <div key={idx} className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden shadow-sm">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                            <h4 className="font-bold text-blue-600 text-sm uppercase tracking-wide">
                                {section.title}
                            </h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => insertImage(idx)}
                                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                                    title="Insertar imagen"
                                >
                                    🖼️ Imagen
                                </button>
                                <button
                                    onClick={() => removeSection(idx)}
                                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                                >
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
                            className="w-full p-4 text-sm focus:outline-none min-h-[150px]"
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
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <div className="border-t p-3 bg-white flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
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
