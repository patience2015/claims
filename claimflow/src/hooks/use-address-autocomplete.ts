import { useState, useCallback } from "react";

export interface AddressResult {
    formattedAddress: string;
    city: string;
    zipCode: string;
    country: string;
    lat: number;
    lng: number;
}

export function useAddressAutocomplete() {
    const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
    const [loading, setLoading] = useState(false);

    const searchAddress = useCallback(async (query: string) => {
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            // API Adresse (Base Adresse Nationale) - France Only & Free
            const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;
            const res = await fetch(url);
            const data = await res.json();

            interface BANFeature {
                type: string;
                geometry: { coordinates: [number, number] };
                properties: {
                    label: string;
                    postcode: string;
                    city: string;
                    context: string;
                    name: string;
                };
            }

            if (!data.features || !Array.isArray(data.features)) {
                setSuggestions([]);
                return;
            }

            const results: AddressResult[] = (data.features as BANFeature[]).map((f) => {
                const p = f.properties;
                const coords = f.geometry.coordinates;

                return {
                    formattedAddress: p.label,
                    city: p.city,
                    zipCode: p.postcode,
                    country: "France",
                    lat: coords[1],
                    lng: coords[0]
                };
            });

            setSuggestions(results);
        } catch (error) {
            console.error("Erreur lors de la recherche d'adresse BAN:", error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        suggestions,
        loading,
        searchAddress,
        setSuggestions
    };
}
