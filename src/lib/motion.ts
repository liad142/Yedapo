import { useReducedMotion } from 'framer-motion';

export const springSnappy = { type: "spring", stiffness: 500, damping: 30 } as const;
export const springGentle = { type: "spring", stiffness: 200, damping: 20 } as const;
export const springBouncy = { type: "spring", stiffness: 400, damping: 15, mass: 0.8 } as const;

// Reduced motion variants
const noMotion = { duration: 0 } as const;

export function useSafeSpring(spring: typeof springSnappy | typeof springGentle | typeof springBouncy) {
  const prefersReduced = useReducedMotion();
  return prefersReduced ? noMotion : spring;
}

export { useReducedMotion };
