'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface DraggableBlockProps {
  id: string
  x: number
  y: number
  isSelected: boolean
  onClick: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}

export function DraggableBlock({ id, x, y, isSelected, onClick, children, style }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
  })

  const combinedStyle = {
    transform: CSS.Translate.toString(transform),
    position: 'absolute' as const,
    left: x + 'px',
    top: y + 'px',
    cursor: isSelected ? 'move' : 'pointer',
    zIndex: isSelected ? 50 : (id === 'logo' ? 10 : 5),
    ...style
  }

  const cls = [
    'group relative transition-all duration-300 ease-out will-change-transform',
    isSelected ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-white shadow-[0_10px_40px_rgba(99,102,241,0.3)] z-50 scale-[1.02]' : 'hover:ring-1 hover:ring-indigo-300 hover:ring-offset-2 z-10 hover:shadow-lg'
  ].join(' ');

  return (
    <div 
        ref={setNodeRef} 
        style={{ 
          ...combinedStyle,
          minHeight: '20px',
          minWidth: '40px'
        }}
        {...listeners} 
        {...attributes} 
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className={cls}
    >
      {children}
      {isSelected && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white backdrop-blur-md border border-white/20 shadow-xl text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap z-50">
            {id}
          </div>
      )}
    </div>
  )
}
