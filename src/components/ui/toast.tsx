"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { elevation } from "@/lib/elevation"

interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  position?: 'top' | 'bottom'
}

export function Toast({ open, onOpenChange, children, position = 'bottom' }: ToastProps) {
  if (!open) return null

  return (
    <div className={cn(
      "fixed left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4",
      position === 'bottom' ? 'bottom-6' : 'top-6',
      "animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
    )}>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-lg p-4 shadow-lg border",
          elevation.floating,
          "backdrop-blur-xl"
        )}
      >
        {children}
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Dismiss notification"
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
