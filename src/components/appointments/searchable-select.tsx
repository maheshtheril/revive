'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface Option {
    id: string
    label: string
    subtitle?: string
}

interface SearchableSelectProps {
    options: Option[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    name: string
    required?: boolean
    className?: string
    isDark?: boolean
}

export function SearchableSelect({
    options,
    value: initialValue,
    onChange,
    placeholder = "Search...",
    name,
    required = false,
    className = "",
    isDark = false
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    // Fully Controlled Component logic
    // We trust the parent (AppointmentForm) to handle state updates via onChange.
    // We strictly use `props.value` (aliased as initialValue here, but it's the current value) for rendering.

    const currentId = initialValue || '';
    const selectedOption = options.find(opt => opt.id === currentId);

    // State for navigation
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.subtitle?.toLowerCase().includes(search.toLowerCase())
    )

    // Reset highlighted index when filtered options change
    useEffect(() => {
        setHighlightedIndex(0)
    }, [search])

    const optionsListRef = useRef<HTMLDivElement>(null)

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
                break
            case 'Enter':
                e.preventDefault()
                if (filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex].id)
                }
                break
            case 'Escape':
                e.preventDefault()
                setOpen(false)
                break
        }
    }

    // Scroll highlighted item into view
    useEffect(() => {
        if (open && optionsListRef.current) {
            const activeElement = optionsListRef.current.children[highlightedIndex] as HTMLElement
            if (activeElement) {
                activeElement.scrollIntoView({ block: 'nearest' })
            }
        }
    }, [highlightedIndex, open])

    const handleSelect = (optionId: string) => {
        onChange(optionId)
        setOpen(false)
        setSearch('')
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
        setSearch('')
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    ref={buttonRef}
                    className={cn(
                        "w-full p-2.5 bg-white dark:bg-slate-950 text-left border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium transition-all flex items-center justify-between text-sm",
                        className
                    )}
                >
                    <span className={selectedOption ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <div className="flex items-center gap-2">
                        {currentId && (
                            <X
                                className="h-4 w-4 text-gray-400 hover:text-gray-600 z-10"
                                onClick={handleClear}
                            />
                        )}
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] min-w-[400px] max-w-[95vw] p-0 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 z-[100] shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()} // Prevent auto-focusing the content wrapper, let input autofocus handle it? Actually input autoFocus works.
            >
                <div className="flex flex-col max-h-80">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 sticky top-0 z-10">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={`Search ${placeholder.toLowerCase()}...`}
                                className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div
                        ref={optionsListRef}
                        className="overflow-y-auto flex-1 p-1 custom-scrollbar"
                    >
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        handleSelect(option.id)
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={cn(
                                        "w-full px-4 py-2 text-left transition-colors rounded-md flex items-center justify-between group",
                                        index === highlightedIndex ? "bg-blue-50 dark:bg-slate-800" : "hover:bg-blue-50 dark:hover:bg-slate-800",
                                        currentId === option.id && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                                    )}
                                >
                                    <div>
                                        <div className="font-medium text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                                            {option.label}
                                        </div>
                                        {option.subtitle && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {option.subtitle}
                                            </div>
                                        )}
                                    </div>
                                    {currentId === option.id && (
                                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>

            {/* Hidden Input for Form Submission */}
            <input type="hidden" name={name} value={currentId} required={required} />
        </Popover>
    )
}
