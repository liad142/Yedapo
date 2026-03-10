import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

describe('Toast Accessibility', () => {
  it('renders with role="status" and aria-live', () => {
    const source = readSource('src/components/ui/toast.tsx');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});

describe('QueueToast Accessibility', () => {
  it('has role="status" and aria-live', () => {
    const source = readSource('src/components/QueueToast.tsx');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});

describe('SummaryModal Accessibility', () => {
  it('has dialog role and aria-modal', () => {
    const source = readSource('src/components/discovery/SummaryModal.tsx');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
  });
});

describe('UpgradeModal Accessibility', () => {
  it('has dialog role and aria-modal', () => {
    const source = readSource('src/components/UpgradeModal.tsx');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
  });
});

describe('Slider Accessibility', () => {
  it('accepts aria-label prop', () => {
    const source = readSource('src/components/ui/slider.tsx');
    expect(source).toContain('aria-label');
  });
});

describe('Reduced Motion', () => {
  it('globals.css has prefers-reduced-motion rule', () => {
    const source = readSource('src/app/globals.css');
    expect(source).toContain('prefers-reduced-motion: reduce');
  });
});

describe('Speed Buttons Accessibility', () => {
  it('ExpandedPlayerView has aria-pressed on speed buttons', () => {
    const source = readSource('src/components/player/ExpandedPlayerView.tsx');
    expect(source).toContain('aria-pressed');
  });
});
