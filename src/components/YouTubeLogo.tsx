/**
 * Official YouTube logo — red rounded-rect play button + "YouTube" wordmark.
 * Links to the original video when `videoId` is provided, or to youtube.com.
 *
 * Sizes: "xs" (inline badges), "sm" (default badges), "md" (headers).
 */
interface YouTubeLogoProps {
  /** Optional video ID — makes the logo link to the original video */
  videoId?: string | null;
  /** Size preset */
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  xs: { icon: 14, text: 'text-[10px]', gap: 'gap-1', height: 'h-4' },
  sm: { icon: 18, text: 'text-xs', gap: 'gap-1', height: 'h-5' },
  md: { icon: 22, text: 'text-sm', gap: 'gap-1.5', height: 'h-6' },
} as const;

function YouTubeLogoInner({ size = 'sm', className }: Omit<YouTubeLogoProps, 'videoId'>) {
  const s = sizeMap[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${s.height} ${className ?? ''}`}>
      {/* Official YouTube play-button icon */}
      <svg
        viewBox="0 0 159 110"
        width={s.icon}
        height={Math.round(s.icon * 0.69)}
        aria-hidden="true"
      >
        <path
          d="M154 17.5c-1.82-6.73-7.07-12-13.72-13.73C128.04 0 79.5 0 79.5 0S30.96 0 18.72 3.77C12.07 5.5 6.82 10.77 5 17.5 1.23 29.75 1.23 55 1.23 55s0 25.25 3.77 37.5c1.82 6.73 7.07 12 13.72 13.73C30.96 110 79.5 110 79.5 110s48.54 0 60.78-3.77c6.65-1.73 11.9-7 13.72-13.73 3.77-12.25 3.77-37.5 3.77-37.5s0-25.25-3.77-37.5z"
          fill="#FF0000"
        />
        <path d="M64 79.5L105 55 64 30.5z" fill="#FFF" />
      </svg>
      <span className={`font-medium text-foreground leading-none ${s.text}`}>YouTube</span>
    </span>
  );
}

export function YouTubeLogo({ videoId, size = 'sm', className }: YouTubeLogoProps) {
  const href = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : 'https://www.youtube.com';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center hover:opacity-80 transition-opacity ${className ?? ''}`}
      title="Watch on YouTube"
      onClick={(e) => e.stopPropagation()}
    >
      <YouTubeLogoInner size={size} />
    </a>
  );
}

/** Non-link version for contexts where a link isn't appropriate (e.g. filter buttons) */
export function YouTubeLogoStatic({ size = 'sm', className }: Omit<YouTubeLogoProps, 'videoId'>) {
  return <YouTubeLogoInner size={size} className={className} />;
}
