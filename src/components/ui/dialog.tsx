"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55]">
      {/* Backdrop */}
      <div
        className={cn("fixed inset-0", "bg-black/60 backdrop-blur-sm")}
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  )
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const internalRef = React.useRef<HTMLDivElement>(null)
  const dialogRef = (ref as React.RefObject<HTMLDivElement>) || internalRef

  // Focus trap: focus the dialog on mount, trap Tab within it
  React.useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    el.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [dialogRef])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={cn(
        "fixed left-[50%] top-[50%] z-[55] w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
        "rounded-2xl",
        "bg-background/95 backdrop-blur-xl border border-border shadow-[var(--shadow-floating)]",
        "duration-200 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]",
        "focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 p-6 pb-0",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-h3 leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogClose = ({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "absolute right-2 top-2 rounded-md opacity-70 ring-offset-background transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center",
      "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      "disabled:pointer-events-none",
      className
    )}
    onClick={onClick}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </button>
)
DialogClose.displayName = "DialogClose"

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
}
