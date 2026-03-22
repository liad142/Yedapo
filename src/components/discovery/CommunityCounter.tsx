'use client';

import { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';

function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }

    startTime.current = null;

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(step);
      }
    }

    rafId.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration]);

  return value;
}

export function CommunityCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stats/summary-count')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.count != null) setCount(data.count);
      })
      .catch(() => {});
  }, []);

  const animatedCount = useCountUp(count ?? 0);

  if (count === null || count === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
      <Users className="h-4 w-4" />
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {animatedCount.toLocaleString()}
        </span>
        {' '}episodes summarized by the community
      </span>
    </div>
  );
}
