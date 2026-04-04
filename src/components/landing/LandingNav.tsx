'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { setShowAuthModal } = useAuth();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-200',
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border/50'
          : 'bg-transparent'
      )}
    >
      <nav className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-icon.png"
            alt="Yedapo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-[family-name:var(--font-plus-jakarta)] font-bold text-lg text-foreground">
            Yedapo
          </span>
        </Link>

        {/* Center: Anchor links (desktop only) */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/#features"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
        </div>

        {/* Right: Auth actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setShowAuthModal(true)}
          >
            Sign In
          </Button>
          <Button asChild size="sm">
            <Link href="/discover">Get Started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
