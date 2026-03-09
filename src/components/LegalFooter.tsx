import Link from 'next/link';

export function LegalFooter() {
  return (
    <footer className="lg:pl-64">
      <div className="max-w-7xl mx-auto px-4 py-6 border-t border-border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Yedapo. AI-generated content may be inaccurate.</p>
          <nav className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/dmca" className="hover:text-foreground transition-colors">
              DMCA
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
