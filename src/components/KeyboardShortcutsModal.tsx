'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

const shortcuts = [
  { key: 'Space', description: 'Play / Pause' },
  { key: '←', description: 'Seek back 15s' },
  { key: '→', description: 'Seek forward 15s' },
  { key: 'S', description: 'Summarize episode' },
  { key: 'Esc', description: 'Close modal' },
  { key: '?', description: 'Show this help' },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-shortcuts-modal className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>
        <div className="p-6 pt-4">
          <dl className="space-y-3">
            {shortcuts.map(({ key, description }) => (
              <div key={key} className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">{description}</dt>
                <dd>
                  <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-mono font-medium rounded-md bg-secondary text-secondary-foreground border border-border">
                    {key}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Shortcuts are disabled while typing in text fields.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
