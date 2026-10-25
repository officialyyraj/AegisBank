// src/components/banking/ConfirmModal.tsx — reusable confirmation dialog.
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  children,
  tone = 'default',
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
  tone?: 'default' | 'warning'
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onCancel} className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className="flex items-start gap-3">
              {tone === 'warning' && (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="size-5" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <h3 className="text-base font-semibold">{title}</h3>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
            {children && <div className="mt-4">{children}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
              <Button variant={tone === 'warning' ? 'default' : 'default'} onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
