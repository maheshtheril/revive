'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect, Option } from '@/components/ui/searchable-select';
import { Search, X } from 'lucide-react';
import { getProductsPremium } from '@/app/actions/inventory';

interface ProductSearchClientProps {
    initialQuery?: string;
}

export function ProductSearchClient({ initialQuery }: ProductSearchClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentQuery, setCurrentQuery] = React.useState(initialQuery || "");

    // Sync with prop changes (e.g. from Parent or URL)
    React.useEffect(() => {
        setCurrentQuery(initialQuery || "");
    }, [initialQuery]);

    // Debounced search for products
    const handleSearch = async (query: string): Promise<Option[]> => {
        if (!query || query.length < 2) return [];
        
        try {
            const result = await getProductsPremium(query);
            if (result.success && result.data) {
                return result.data.map(p => ({
                    id: p.id || p.name, // Use actual UUID if available
                    label: p.name,
                    subLabel: `SKU: ${p.sku} | ${p.category}`
                }));
            }
        } catch (err) {
            console.error("Search failed:", err);
        }
        return [];
    };

    const handleSelect = (value: string | null) => {
        setCurrentQuery(value || "");
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set('q', value);
        } else {
            params.delete('q');
        }
        params.set('page', '1'); // Reset to first page
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Search Products / Reference</label>
            <div className="relative group">
                <input type="hidden" name="q" value={currentQuery} />
                <SearchableSelect
                    value={currentQuery}
                    valueLabel={currentQuery}
                    placeholder="Search item, SKU or reference..."
                    onSearch={handleSearch}
                    onChange={(val) => handleSelect(val)}
                    isDark={false}
                    className="w-full"
                    variant="default"
                />
            </div>
        </div>
    );
}
