import React from 'react';
import { motion } from 'framer-motion';

interface ZionaLogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | number;
    variant?: 'full' | 'icon';
    theme?: 'light' | 'dark';
    colorScheme?: 'signature' | 'emerald' | 'ocean' | 'monochrome';
    speed?: 'slow' | 'normal' | 'fast';
}

const colorPresets = {
    signature: ['#10b981', '#06b6d4', '#3b82f6', '#059669', '#0ea5e9', '#2563eb'], // Emerald to Blue Prism
    emerald: ['#10b981', '#059669', '#34d399', '#059669', '#047857', '#065f46'],
    ocean: ['#0ea5e9', '#0284c7', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
    monochrome: ['#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
};

export const ZionaLogo: React.FC<ZionaLogoProps> = ({
    className = '',
    size = 'md',
    variant = 'full',
    theme = 'light',
    colorScheme = 'signature',
    speed = 'slow'
}) => {
    const sizeMap = {
        sm: 24,
        md: 40,
        lg: 64,
        xl: 120,
    };

    const colors = colorPresets[colorScheme] || colorPresets.signature;
    const finalSize = typeof size === 'number' ? size : sizeMap[size];
    const duration = speed === 'fast' ? '1.5s' : speed === 'slow' ? '6s' : '3s';
    const textColor = theme === 'light' ? '#0f172a' : '#ffffff';

    return (
        <div className={`flex items-center gap-3 ${className}`} style={{ height: finalSize }}>
            {/* High-Fidelity World Standard 3D Asset */}
            <div 
                className="relative overflow-hidden rounded-xl shadow-2xl"
                style={{ width: finalSize, height: finalSize }}
            >
                <img 
                    src="/ziona.png" 
                    alt="Ziona" 
                    className="w-full h-full object-contain transform scale-110"
                />
                {/* Subtle Glass Glint Layer */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-30 animate-pulse pointer-events-none" />
            </div>

            {variant === 'full' && (
                <div className="flex flex-col justify-center leading-tight">
                    <span
                        style={{
                            fontSize: finalSize * 0.5,
                            fontWeight: '800',
                            letterSpacing: '-0.02em',
                            color: textColor,
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                        className="tracking-tight uppercase"
                    >
                        Ziona
                    </span>
                    <div className="flex items-center gap-1.5 opacity-50">
                        <div className="h-px w-3 bg-current shrink-0" />
                        <span
                            className="text-[0.22em] font-mono tracking-[0.3em] uppercase font-bold"
                            style={{ color: colors[0], fontSize: finalSize * 0.14 }}
                        >
                            Antigravity OS
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
