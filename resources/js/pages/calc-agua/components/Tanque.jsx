import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const Tanque = ({ initialData, canEdit, editMode, onChange, globalDemandaTotal }) => {
    const [consumoDiario, setConsumoDiario] = useState((globalDemandaTotal && globalDemandaTotal > 0) ? globalDemandaTotal : (initialData?.consumoDiario ?? 0));
    const [largo, setLargo] = useState(initialData?.largo ?? 2.40);
    const [ancho, setAncho] = useState(initialData?.ancho ?? 1.50);
    const [alturaUtil, setAlturaUtil] = useState(initialData?.alturaUtil ?? 1.20);
    const [bordeLibre, setBordeLibre] = useState(initialData?.bordeLibre ?? 0.30);
    const [nivelagua, setNivelagua] = useState(initialData?.nivelagua ?? 0.50);
    const [alturaTecho, setAlturaTecho] = useState(initialData?.alturaTecho ?? 0.20);

    const [canvasReady, setCanvasReady] = useState(false);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (globalDemandaTotal !== undefined && globalDemandaTotal > 0) {
            setConsumoDiario(parseFloat(globalDemandaTotal));
        }
    }, [globalDemandaTotal]);

    // Cálculos
    const volumenTanque = useMemo(() => {
        return (1 / 3) * (consumoDiario / 1000);
    }, [consumoDiario]);

    const volumenTotal = volumenTanque;

    const alturaAguaMin = useMemo(() => {
        if (largo === 0 || ancho === 0) return 0;
        return volumenTanque / (largo * ancho);
    }, [volumenTanque, largo, ancho]);

    const volumenCalculado = useMemo(() => {
        return largo * ancho * alturaUtil;
    }, [largo, ancho, alturaUtil]);

    const alturaTotal = useMemo(() => {
        return parseFloat((parseFloat(alturaUtil) + parseFloat(bordeLibre) + parseFloat(alturaTecho)).toFixed(2));
    }, [alturaUtil, bordeLibre, alturaTecho]);

    const calculateTanqueData = useCallback(() => {
        const round = (num, decimals = 4) => parseFloat(num.toFixed(decimals));

        const alturaIngreso = (volumenCalculado <= 12) ? 0.15 : ((volumenCalculado <= 30) ? 0.2 : 0.3);
        const volumenTanqueReal = (volumenCalculado > 30) ? 0.15 : 0.10;

        const nivel1 = round(parseFloat(nivelagua) - 0.2);
        const nivel2 = round(nivel1 - parseFloat(alturaTecho));
        const nivel3 = round(nivel2 - alturaIngreso);
        const nivel4 = round(nivel3 - volumenTanqueReal);
        const nivel5 = round(nivel4 - parseFloat(alturaUtil));

        return {
            alturaIngreso,
            volumenTanqueReal,
            nivel1,
            nivel2,
            nivel3,
            nivel4,
            nivel5
        };
    }, [volumenCalculado, nivelagua, alturaTecho, alturaUtil]);

    const sendDataUpdate = useCallback(() => {
        const data = {
            consumoDiario,
            largo,
            ancho,
            alturaUtil,
            bordeLibre,
            nivelagua,
            alturaTecho,
            volumenTanque,
            volumenCalculado,
            alturaTotal,
            ...calculateTanqueData()
        };

        const event = new CustomEvent('tanque-updated', { detail: data });
        document.dispatchEvent(event);

        if (onChange) {
            onChange(data);
        }
    }, [consumoDiario, largo, ancho, alturaUtil, bordeLibre, nivelagua, alturaTecho, volumenTanque, volumenCalculado, alturaTotal, calculateTanqueData, onChange]);

    // Disparar update al cambiar valores
    useEffect(() => {
        const timeout = setTimeout(() => {
            sendDataUpdate();
        }, 150);
        return () => clearTimeout(timeout);
    }, [sendDataUpdate]);

    // Recibir evento de demanda diaria
    useEffect(() => {
        const handleDemandaDiariaUpdate = (event) => {
            const data = event.detail;
            setConsumoDiario(parseFloat(data.totalCaudal) || 0);
        };

        document.addEventListener('demanda-diaria-updated', handleDemandaDiariaUpdate);
        return () => {
            document.removeEventListener('demanda-diaria-updated', handleDemandaDiariaUpdate);
        };
    }, []);

    // Dibujo del Canvas
    const drawTanqueNative = useCallback(() => {
        const canvasElement = canvasRef.current;
        if (!canvasElement) return;

        const ctx = canvasElement.getContext('2d');
        const container = containerRef.current;
        if (!container) return;

        canvasElement.width = container.clientWidth || 650;
        canvasElement.height = 450;

        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

        const marginLeft = 80;
        const marginRight = 200;
        const marginTop = 60;
        const marginBottom = 80;
        const drawingWidth = canvasElement.width - marginLeft - marginRight;
        const drawingHeight = canvasElement.height - marginTop - marginBottom;

        const scale = Math.min(drawingWidth / (parseFloat(largo) || 1), drawingHeight / (alturaTotal || 1)) * 0.8;
        const tanqueWidth = (parseFloat(largo) || 0) * scale;
        const tanqueHeight = (alturaTotal || 0) * scale;
        const startX = marginLeft + (drawingWidth - tanqueWidth) / 2;
        const startY = marginTop + (drawingHeight - tanqueHeight) / 2;

        // Estructura principal
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(startX, startY, tanqueWidth, tanqueHeight);
        ctx.strokeRect(startX, startY, tanqueWidth, tanqueHeight);

        // Área de agua
        const alturaAguaEscalada = (parseFloat(alturaUtil) || 0) * scale;
        const waterY = startY + tanqueHeight - alturaAguaEscalada;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.6)'; // indigo
        ctx.fillRect(startX + 2, waterY, tanqueWidth - 4, alturaAguaEscalada - 2);

        // Líneas divisorias
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const techoY = startY + ((parseFloat(alturaTecho) || 0) * scale);

        ctx.beginPath();
        ctx.moveTo(startX, waterY);
        ctx.lineTo(startX + tanqueWidth, waterY);
        ctx.moveTo(startX, techoY);
        ctx.lineTo(startX + tanqueWidth, techoY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Etiquetas
        const fontSize = Math.max(10, Math.min(14, tanqueWidth / 25));
        ctx.fillStyle = '#374151';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText('TECHO', startX + tanqueWidth / 2, startY + ((parseFloat(alturaTecho) || 0) * scale) / 2);
        ctx.fillText('BORDE LIBRE', startX + tanqueWidth / 2, techoY + ((parseFloat(bordeLibre) || 0) * scale) / 2);

        ctx.fillStyle = '#ffffff';
        ctx.fillText('AGUA', startX + tanqueWidth / 2, waterY + alturaAguaEscalada / 2);

        // Cotas y medidas
        const measureFontSize = Math.max(9, Math.min(12, canvasElement.width / 60));
        ctx.fillStyle = '#374151';
        ctx.font = `${measureFontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const cotaX = startX + tanqueWidth + 25;
        ctx.fillText(`${parseFloat(alturaTecho)} m`, cotaX, startY + ((parseFloat(alturaTecho) || 0) * scale) / 2);
        ctx.fillText(`${parseFloat(bordeLibre)} m`, cotaX, techoY + ((parseFloat(bordeLibre) || 0) * scale) / 2);
        ctx.fillText(`${parseFloat(alturaUtil)} m`, cotaX, waterY + alturaAguaEscalada / 2);

        ctx.textAlign = 'center';
        ctx.fillText(`${parseFloat(largo)} m`, startX + tanqueWidth / 2, startY + tanqueHeight + 35);

        // Título
        ctx.font = `bold ${Math.max(12, Math.min(16, canvasElement.width / 50))}px Arial`;
        ctx.fillText('TANQUE ELEVADO - VISTA FRONTAL', canvasElement.width / 2, 25);

        // Información adicional
        ctx.font = `${measureFontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#4b5563';

        const infoTexts = [
            `Vol. Requerido: ${volumenTanque.toFixed(2)} m³`,
            `Vol. Calculado: ${volumenCalculado.toFixed(2)} m³`,
            `Ancho: ${ancho} m`
        ];

        infoTexts.forEach((text, index) => {
            ctx.fillText(text, 20, 60 + (index * (measureFontSize + 5)));
        });
    }, [largo, ancho, alturaUtil, bordeLibre, alturaTecho, alturaTotal, volumenTanque, volumenCalculado]);

    useEffect(() => {
        let resizeTimeout;
        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (canvasReady) {
                    drawTanqueNative();
                }
            }, 100);
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeObserver.disconnect();
        };
    }, [canvasReady, drawTanqueNative]);

    useEffect(() => {
        setCanvasReady(true);
        drawTanqueNative();
    }, [drawTanqueNative]);

    return (
        <div className="w-full p-4">
            {/* Header Principal */}
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 rounded-2xl shadow-lg sticky top-12 z-50">
                <div className="w-full mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl shadow-lg">
                                <i className="fas fa-cube text-white text-lg"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">3. CALCULO DEL ALMACENAMIENTO - TANQUE ELEVADO</h1>
                                <p className="text-sm text-slate-600">Cálculo de consumo de agua</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-full px-1 py-2 space-y-2">
                <div className="p-1">
                    {/* Input Parameters */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-6">
                            <div className="bg-slate-50 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">3.1.1. CÁLCULO DE VOLUMEN</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Consumo Diario Total (Lt/día)</label>
                                        <input type="number" step="0.01" value={consumoDiario || ''}
                                            className="w-full px-4 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-100"
                                            readOnly />
                                        <p className="text-xs text-slate-500 mt-1">
                                            {(!consumoDiario || consumoDiario === 0) ?
                                                <span>Ingresa datos en "Cálculo de la Demanda Diaria" (sección 1)</span> :
                                                <span>Valor recibido de la sección de Demanda Diaria.</span>
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 p-4 rounded-lg">
                                        <p className="text-sm text-indigo-800 mb-2">VOL. DE TANQUE ELEVADO = 1/3 x CONSUMO DIARIO TOTAL</p>
                                        <p className="text-lg font-semibold text-indigo-900">Vol. De Tanque = {(volumenTanque || 0).toFixed(2)} m³</p>
                                        <p className="text-sm text-slate-600 mt-2">Vol. Total mínimo = {(volumenTotal || 0).toFixed(2)} m³</p>
                                        <p className="text-sm text-slate-600">Altura de agua mín. = {(alturaAguaMin || 0).toFixed(2)} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Dimensiones del Tanque Elevado</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Largo (L) m</label>
                                        <input type="number" step="0.01" value={largo} onChange={(e) => setLargo(e.target.value)} disabled={!editMode}
                                            className="w-full px-3 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Ancho (A) m</label>
                                        <input type="number" step="0.01" value={ancho} onChange={(e) => setAncho(e.target.value)} disabled={!editMode}
                                            className="w-full px-3 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Altura Útil (H) m</label>
                                        <input type="number" step="0.01" value={alturaUtil} onChange={(e) => setAlturaUtil(e.target.value)} disabled={!editMode}
                                            className="w-full px-3 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Borde Libre (bl) m</label>
                                        <input type="number" step="0.01" value={bordeLibre} onChange={(e) => setBordeLibre(e.target.value)} disabled={!editMode}
                                            className="w-full px-3 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Nivel m</label>
                                        <input type="number" step="0.01" value={nivelagua} onChange={(e) => setNivelagua(e.target.value)} disabled={!editMode}
                                            className="w-full px-3 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">H. techo (Ht) m</label>
                                        <input type="number" step="0.01" value={alturaTecho} onChange={(e) => setAlturaTecho(e.target.value)} disabled={!editMode}
                                            className="w-full px-3 py-2 text-gray-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                                    <p className="text-lg font-bold text-green-800">VOLUMEN DE TANQUE = {(volumenCalculado || 0).toFixed(2)} m³</p>
                                    {volumenCalculado < volumenTanque && (
                                        <p className="text-base font-semibold text-red-600 mt-2">CORREGIR DIMENSIONES</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Graphic Section */}
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Diagrama de Tanque</h3>
                                <div className="relative w-full" style={{ height: "450px" }} ref={containerRef}>
                                    {!canvasReady && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                                <p className="text-sm text-gray-600">Cargando diagrama...</p>
                                            </div>
                                        </div>
                                    )}
                                    <canvas ref={canvasRef}
                                        className="border border-slate-300 rounded w-full h-full"
                                        style={{ maxWidth: "100%", maxHeight: "450px", display: canvasReady ? 'block' : 'none' }}></canvas>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-6">
                                <h3 className="text-xs font-semibold text-slate-800 mb-4">3.1.2. DIMENSIONES DEL TANQUE ELEVADO</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">ANCHO (A): {ancho} m</span>
                                        <span className="text-xs">Ancho del Tanque</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">LARGO (L): {largo} m</span>
                                        <span className="text-xs">Largo del Tanque</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">ALTURA DE AGUA (H): {alturaUtil} m</span>
                                        <span className="text-xs">Altura de agua del Tanque</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Borde Libre (bl): {bordeLibre} m</span>
                                        <span className="text-xs">Altura del Tanque</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Altura total (HT): {alturaTotal} m</span>
                                        <span className="text-xs">Altura total del Tanque</span>
                                    </div>
                                    <div className="text-sm text-slate-600 mt-4">
                                        <p><strong>ALTURA DE TUB. REBOSE:</strong> La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0.10 m</p>
                                        <p><strong>ALTURA DE TUB. DE INGRESO:</strong> La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0.15 m</p>
                                        <p><strong>ALTURA DE NIVEL DE TECHO:</strong> La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0.20 m</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Tanque;