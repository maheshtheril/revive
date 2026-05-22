'use client'

import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (type !== 'password' && type !== 'email' && type !== 'url' && type !== 'search') {
                const val = e.target.value;
                if (val && val.length > 0) {
                    const start = e.target.selectionStart;
                    // Capitalize first letter
                    // And Capitalize after sentence terminators
                    const newVal = val.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

                    if (newVal !== val) {
                        e.target.value = newVal;
                        e.target.setSelectionRange(start, start);
                    }
                }
            }
            onChange?.(e);
        }

        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground dark:text-white transition-colors duration-200",
                    className
                )}
                ref={ref}
                spellCheck={type !== 'password' && type !== 'email'}
                autoCapitalize={type === 'password' || type === 'email' || type === 'url' ? "none" : "sentences"}
                onChange={handleChange}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
