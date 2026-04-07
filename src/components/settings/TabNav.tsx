'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Bell, Link2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/settings/profile', label: 'Profile', icon: User },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/connections', label: 'Connections', icon: Link2 },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
] as const;

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border mb-8" role="tablist">
      <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                'flex items-center gap-2 pb-3 px-1 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                isActive
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
