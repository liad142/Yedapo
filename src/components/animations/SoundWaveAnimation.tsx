"use client";

import { motion } from 'framer-motion';

interface SoundWaveAnimationProps {
  className?: string;
}

export function SoundWaveAnimation({ className = '' }: SoundWaveAnimationProps) {
  const barColors = [
    'from-primary to-primary/80',
    'from-primary to-primary/80',
    'from-primary to-primary/80',
    'from-primary to-primary/80',
  ];

  // Max height for the bars (used as reference for scaleY=1)
  const maxHeight = 24;

  return (
    <div className={`flex items-end justify-center gap-1 ${className}`}>
      {barColors.map((color, index) => (
        <motion.div
          key={index}
          className={`w-1 rounded-full bg-gradient-to-t ${color}`}
          style={{ height: maxHeight, transformOrigin: 'bottom', willChange: 'transform, opacity' }}
          initial={{ scaleY: 8 / maxHeight }}
          animate={{
            scaleY: [8 / maxHeight, 20 / maxHeight, 12 / maxHeight, 24 / maxHeight, 8 / maxHeight],
            opacity: [0.7, 1, 0.8, 1, 0.7],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
