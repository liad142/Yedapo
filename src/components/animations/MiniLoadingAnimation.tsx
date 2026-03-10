"use client";

import { motion } from 'framer-motion';

interface MiniLoadingAnimationProps {
  message: string;
  className?: string;
}

export function MiniLoadingAnimation({ message, className = '' }: MiniLoadingAnimationProps) {
  const barColors = [
    'from-primary to-primary/80',
    'from-primary to-primary/80',
    'from-primary to-primary/80',
  ];

  // Max height for the bars (used as reference for scaleY=1)
  const maxHeight = 18;

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}>
      <div className="flex items-end justify-center gap-1">
        {barColors.map((color, index) => (
          <motion.div
            key={index}
            className={`w-1 rounded-full bg-gradient-to-t ${color}`}
            style={{ height: maxHeight, transformOrigin: 'bottom', willChange: 'transform, opacity' }}
            initial={{ scaleY: 6 / maxHeight }}
            animate={{
              scaleY: [6 / maxHeight, 16 / maxHeight, 10 / maxHeight, 18 / maxHeight, 6 / maxHeight],
              opacity: [0.6, 1, 0.7, 1, 0.6],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * 0.12,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">This usually takes a few moments</p>
      </div>
    </div>
  );
}
