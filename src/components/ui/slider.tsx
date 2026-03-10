'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  max?: number;
  min?: number;
  step?: number;
  className?: string;
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      onValueChange,
      max = 100,
      min = 0,
      step = 1,
      className,
      trackClassName,
      rangeClassName,
      thumbClassName,
      disabled = false,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const percentage = ((value[0] - min) / (max - min)) * 100;

    const updateValue = React.useCallback(
      (clientX: number) => {
        if (!trackRef.current || disabled) return;

        const rect = trackRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const rawValue = min + percent * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;
        const clampedValue = Math.max(min, Math.min(max, steppedValue));

        onValueChange([clampedValue]);
      },
      [min, max, step, onValueChange, disabled]
    );

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging(true);
        updateValue(e.clientX);
      },
      [updateValue, disabled]
    );

    const handleTouchStart = React.useCallback(
      (e: React.TouchEvent) => {
        if (disabled) return;
        setIsDragging(true);
        updateValue(e.touches[0].clientX);
      },
      [updateValue, disabled]
    );

    React.useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        updateValue(e.clientX);
      };

      const handleTouchMove = (e: TouchEvent) => {
        updateValue(e.touches[0].clientX);
      };

      const handleEnd = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }, [isDragging, updateValue]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex w-full touch-none select-none items-center',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <div
          ref={trackRef}
          className={cn(
            'relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10',
            trackClassName
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div
            className={cn(
              'absolute h-full bg-primary transition-all',
              rangeClassName
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className={cn(
            'absolute block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-lg ring-offset-background transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isDragging && 'scale-110',
            !disabled && 'cursor-grab active:cursor-grabbing',
            thumbClassName
          )}
          style={{ left: `calc(${percentage}% - 8px)` }}
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value[0]}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            let newValue = value[0];
            switch (e.key) {
              case 'ArrowRight':
              case 'ArrowUp':
                e.preventDefault();
                newValue = Math.min(max, value[0] + step);
                break;
              case 'ArrowLeft':
              case 'ArrowDown':
                e.preventDefault();
                newValue = Math.max(min, value[0] - step);
                break;
              case 'Home':
                e.preventDefault();
                newValue = min;
                break;
              case 'End':
                e.preventDefault();
                newValue = max;
                break;
              default:
                return;
            }
            onValueChange([newValue]);
          }}
        />
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export { Slider };
