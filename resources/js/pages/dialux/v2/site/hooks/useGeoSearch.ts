import { useState } from 'react';
import type { GeoLocation } from '../domain/types';
import { searchLocation } from '../lib/geoApi';

export function useGeoSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoLocation[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string>();
    const [selectedLocation, setSelectedLocation] =
        useState<GeoLocation | null>(null);

    const search = async () => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            return;
        }
        setSearching(true);
        setError(undefined);
        try {
            setResults(await searchLocation(trimmed));
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'No se pudo buscar la ubicación.',
            );
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const selectLocation = (result: GeoLocation) => {
        setSelectedLocation(result);
    };

    return {
        query,
        setQuery,
        results,
        searching,
        error,
        search,
        selectedLocation,
        selectLocation,
    };
}
