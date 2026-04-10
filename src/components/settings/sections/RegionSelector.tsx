'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search as SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import posthog from 'posthog-js';
import { useCountry } from '@/contexts/CountryContext';
import { APPLE_PODCAST_COUNTRIES } from '@/types/apple-podcasts';
import { cn } from '@/lib/utils';
import { FieldLabel } from './SectionLabel';
import type { UserProfile } from './types';

// flagcdn.com supported sizes
const FLAG_SIZES = [
  [16, 12],
  [20, 15],
  [24, 18],
  [28, 21],
  [32, 24],
  [40, 30],
  [48, 36],
  [56, 42],
  [64, 48],
  [80, 60],
] as const;

function flagUrl(code: string, targetW: number) {
  const match = FLAG_SIZES.find(([w]) => w >= targetW) || FLAG_SIZES[FLAG_SIZES.length - 1];
  return {
    url: `https://flagcdn.com/${match[0]}x${match[1]}/${code}.png`,
    w: match[0],
    h: match[1],
  };
}

export function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  const x1 = flagUrl(code, size);
  const x2 = flagUrl(code, size * 2);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={x1.url}
      srcSet={`${x2.url} 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt=""
      className="inline-block rounded-sm object-cover"
      style={{ minWidth: size }}
    />
  );
}

interface RegionSelectorProps {
  profile: UserProfile | null;
  onProfileChange: (profile: UserProfile) => void;
  onError?: (message: string) => void;
}

export function RegionSelector({ profile, onProfileChange, onError }: RegionSelectorProps) {
  const { setCountry } = useCountry();
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentCountry = APPLE_PODCAST_COUNTRIES.find(
    (c) => c.code === (profile?.preferred_country || 'us')
  );

  const filteredCountries = APPLE_PODCAST_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSaveCountry = async (code: string) => {
    setCountryOpen(false);
    setCountrySearch('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_country: code }),
      });
      if (res.ok) {
        const d = await res.json();
        onProfileChange(d.profile);
        setCountry(code.toUpperCase());
        posthog.capture('profile_updated', { field: 'country', country_code: code });
      }
    } catch {
      onError?.('Failed to save country preference. Please try again.');
    }
  };

  return (
    <div>
      <FieldLabel>Region</FieldLabel>
      <div ref={countryRef} className="relative mt-2">
        <button
          onClick={() => setCountryOpen((v) => !v)}
          className={cn(
            'w-full sm:w-72 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 bg-card text-left transition-all',
            countryOpen ? 'border-primary shadow-sm' : 'border-border hover:border-border/80'
          )}
        >
          {currentCountry && <FlagImg code={currentCountry.code} size={24} />}
          <span className="flex-1 font-medium text-foreground text-sm truncate">
            {currentCountry?.name}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform shrink-0',
              countryOpen && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {countryOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 mt-2 w-full sm:w-72 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
            >
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search country..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 rounded-lg outline-none focus:bg-muted placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleSaveCountry(c.code)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left',
                      profile?.preferred_country === c.code &&
                        'bg-primary/8 text-primary font-medium'
                    )}
                  >
                    <FlagImg code={c.code} size={18} />
                    <span className="truncate">{c.name}</span>
                    {profile?.preferred_country === c.code && (
                      <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />
                    )}
                  </button>
                ))}
                {filteredCountries.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No results</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
