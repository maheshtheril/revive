'use client'

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function SearchInput({
    placeholder = 'Search...',
    className
}: {
    placeholder?: string
    className?: string
}) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()

    // Local state for immediate input feedback
    const [term, setTerm] = useState(searchParams.get('q')?.toString() || '')

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const params = new URLSearchParams(searchParams)
            if (term) {
                params.set('q', term)
            } else {
                params.delete('q')
            }
            
            // Critical Fix: Prevent infinite loop by checking if the URL actually changed
            if (searchParams.toString() !== params.toString()) {
                replace(`${pathname}?${params.toString()}`)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [term, replace, pathname, searchParams])

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
                type="text"
                placeholder={placeholder}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
        </div>
    )
}
