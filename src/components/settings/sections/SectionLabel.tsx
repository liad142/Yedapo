import { cn } from '@/lib/utils';

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-xs font-bold uppercase tracking-widest text-muted-foreground/70',
        className
      )}
    >
      {children}
    </p>
  );
}

export function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('text-h4 text-foreground', className)}>{children}</p>;
}
