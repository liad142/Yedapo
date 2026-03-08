"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Compass, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-14 lg:top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/logo-icon-48.png" alt="Sumfi" width={32} height={32} className="h-8 w-8" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Sumfi
          </span>
        </Link>
        <nav className="ml-auto flex items-center space-x-2">
          <Button
            variant={isActive("/") && !pathname.startsWith("/discover") ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/" className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              <span className="hidden sm:inline">My Podcasts</span>
            </Link>
          </Button>
          <Button
            variant={isActive("/discover") ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/discover" className="flex items-center gap-2">
              <Compass className="h-4 w-4" />
              <span className="hidden sm:inline">Discover</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
