'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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
    <nav
      className="relative border-b border-border mb-8"
      role="tablist"
      aria-label="Settings sections"
    >
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                'relative flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-t-lg',
                'text-sm font-medium whitespace-nowrap transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isActive && 'text-primary'
                )}
              />
              {/* Label: always visible on sm+, hidden below */}
              <span className="hidden sm:inline">{tab.label}</span>

              {/* Animated sliding underline — shared layoutId creates the tween */}
              {isActive && (
                <motion.span
                  layoutId="settings-tab-underline"
                  className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-primary"
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                    mass: 0.8,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
