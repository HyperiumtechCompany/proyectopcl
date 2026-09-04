import { AlertTriangle, Loader2, MapPin, Search } from 'lucide-react';
import type { GeoLocation } from '../domain/types';
import { useGeoSearch } from '../hooks/useGeoSearch';
import { getTerrainInfo } from '../lib/geoApi';

interface Props {
    onUseLocation?: (location: GeoLocation) => void;
}

export function GeoSearchPanel({ onUseLocation }: Props) {
    const {
        query,
        setQuery,
        results,
        searching,
        error,
        search,
        selectedLocation,
        selectLocation,
    } = useGeoSearch();

    return (
        <aside className="w-full border-b border-slate-200 bg-white lg:w-72 lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-[#101218]">
            <div className="border-b border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <MapPin className="h-4 w-4 text-amber-500" /> Ubicación del
                    proyecto
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Busca la dirección o nombre del terreno para posicionar el
                    emplazamiento.
                </p>
            </div>
            <div className="space-y-3 p-3">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void search();
                    }}
                    className="flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Colegio San Martín, Lima"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-cyan-500 dark:border-white/15 dark:bg-[#182237] dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={searching || query.trim().length === 0}
                        className="flex h-9 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                    >
                        {searching ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Search className="h-3.5 w-3.5" />
                        )}
                        Buscar
                    </button>
                </form>

                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {results.length > 0 && (
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                        {results.map((result, index) => (
                            <li key={`${result.lat}:${result.lon}:${index}`}>
                                <button
                                    type="button"
                                    onClick={() => selectLocation(result)}
                                    className={`block w-full rounded-lg border px-2 py-1.5 text-left text-[11px] leading-snug ${
                                        selectedLocation === result
                                            ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200'
                                            : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                                    }`}
                                >
                                    {result.displayName}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {selectedLocation && (
                    <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] dark:border-white/10 dark:bg-white/5">
                        <p>
                            📌 Coordenadas:{' '}
                            <span className="font-mono">
                                {selectedLocation.lat.toFixed(4)},{' '}
                                {selectedLocation.lon.toFixed(4)}
                            </span>
                        </p>
                        <p>
                            🏘️ Zona:{' '}
                            {getTerrainInfo(selectedLocation).zoneLabel}
                        </p>
                        <button
                            type="button"
                            onClick={() => onUseLocation?.(selectedLocation)}
                            disabled={!onUseLocation}
                            className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                        >
                            Usar como fondo del emplazamiento
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
