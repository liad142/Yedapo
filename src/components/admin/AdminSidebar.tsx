'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Database,
  Brain,
  BarChart3,
  Bell,
  Activity,
  Shield,
  Compass,
  Menu,
  X,
  Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { elevation } from '@/lib/elevation';

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Content', href: '/admin/content', icon: Database },
  { label: 'AI Pipeline', href: '/admin/ai', icon: Brain },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'System', href: '/admin/system', icon: Activity },
  { label: 'Providers', href: '/admin/providers', icon: Plug },
] as const;

function NavItem({ item, isActive, onClick }: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Yedapo Admin
          </span>
        </div>
      </div>

      {/* Back to app */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/discover"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Compass className="h-4 w-4" />
          <span>Back to Yedapo</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname.startsWith(item.href)}
            onClick={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

export function AdminSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const pathname = usePathname();

  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur border-b border-border z-50 lg:hidden">
        <div className="flex items-center justify-between h-full px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">Admin</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile Drawer */}
      <>
        <div
          className={cn(
            'fixed inset-0 bg-black/50 z-[60] transition-opacity lg:hidden',
            isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation menu"
          className={cn(
            'fixed top-0 left-0 bottom-0 w-72 z-[60] transition-transform lg:hidden',
            elevation.sidebar,
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <button
            onClick={closeMobileMenu}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Close admin menu"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarContent onNavigate={closeMobileMenu} />
        </div>
      </>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-64 hidden lg:flex flex-col z-30',
          elevation.sidebar
        )}
        aria-label="Admin navigation"
      >
        <SidebarContent />
      </aside>
    </>
  );
}
