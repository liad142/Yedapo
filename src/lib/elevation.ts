/* ── Z-index scale ─────────────────────────────────────── */
export const zIndex = {
  zBase: 0,
  zSticky: 10,
  zNav: 30,
  zHeader: 40,
  zPlayer: 45,
  zOverlay: 50,
  zModal: 55,
  zToast: 60,
  zTop: 99,
} as const;

export const elevation = {
  // Card/Panel surfaces
  card: "bg-card border border-border shadow-[var(--shadow-1)] rounded-2xl",
  cardHover: "hover:bg-secondary hover:shadow-[var(--shadow-2)] transition-all duration-150",
  cardInteractive: "bg-card border border-border shadow-[var(--shadow-1)] rounded-2xl cursor-pointer hover:bg-secondary hover:shadow-[var(--shadow-2)] transition-all duration-150",

  // Surfaces
  surface: "bg-card",
  surfaceRaised: "bg-secondary",

  // Sidebar/Navigation
  sidebar: "bg-background border-r border-border",

  // Inputs
  input: "bg-secondary border border-border-strong rounded-xl focus:border-primary focus:ring-2 focus:ring-ring/20",

  // Buttons
  buttonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium transition-colors duration-150 cursor-pointer",
  buttonSecondary: "bg-secondary text-secondary-foreground hover:bg-accent rounded-xl font-medium transition-colors duration-150 cursor-pointer",
  buttonGhost: "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground rounded-xl transition-colors duration-150 cursor-pointer",

  // Overlays/Modals — KEEP glass effects here
  overlay: "bg-black/60 backdrop-blur-sm",
  modal: "bg-background/95 backdrop-blur-xl border border-border shadow-[var(--shadow-floating)] rounded-2xl",

  // Audio player — KEEP glass effect here
  playerBar: "backdrop-blur-xl bg-background/80 border-t border-border",

  // Badges
  badge: "bg-secondary border border-border",

  // Floating elements (dropdowns, popovers)
  floating: "bg-card border border-border shadow-[var(--shadow-floating)] rounded-2xl",

  // Layout
  header: "bg-background/95 backdrop-blur-xl border-b border-border",
} as const;
