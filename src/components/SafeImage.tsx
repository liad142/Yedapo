'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';

/**
 * Hostnames allowed in next.config.js remotePatterns.
 * Used to pre-check before passing to next/image to avoid render-time errors.
 */
const ALLOWED_PATTERNS = [
  /\.mzstatic\.com$/,
  /\.ytimg\.com$/,
  /^i\.ytimg\.com$/,
  /^yt3\.ggpht\.com$/,
  /\.scdn\.co$/,
  /\.podcastindex\.org$/,
  /\.googleusercontent\.com$/,
  /\.githubusercontent\.com$/,
  /\.simplecastcdn\.com$/,
  /\.megaphone\.fm$/,
  /\.omnycontent\.com$/,
  /\.buzzsprout\.com$/,
  /\.libsyn\.com$/,
  /\.podbean\.com$/,
  /\.transistor\.fm$/,
  /\.transistorcdn\.com$/,
  /\.anchor\.fm$/,
  /\.spreaker\.com$/,
  /\.art19\.com$/,
  /\.acast\.com$/,
  /\.captivate\.fm$/,
  /\.blubrry\.com$/,
  /\.podtrac\.com$/,
  /\.soundcloud\.com$/,
  /\.redcircle\.com$/,
  /\.theringer\.com$/,
  /\.podigee\.com$/,
  /\.whooshkaa\.com$/,
  /\.squarespace\.com$/,
  /\.amazonaws\.com$/,
  /\.cloudfront\.net$/,
  /\.wp\.com$/,
  /\.wordpress\.com$/,
  /\.brightspotcdn\.com$/,
];

function isAllowedHostname(src: string): boolean {
  try {
    const { hostname } = new URL(src);
    return ALLOWED_PATTERNS.some((p) => p.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Plain <img> fallback for when next/image can't handle the src.
 */
function ImgFallback({ alt, ...props }: ImageProps) {
  const { fill, sizes, quality, priority, placeholder, blurDataURL, loader, ...imgProps } = props;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      alt={alt}
      src={typeof props.src === 'string' ? props.src : ''}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...((props.style as React.CSSProperties) || {}) } : (props.style as React.CSSProperties)}
    />
  );
}

/**
 * SafeImage wraps next/image with error handling.
 * - Pre-checks hostname against configured remotePatterns to avoid render errors
 * - Catches load-time errors via onError callback
 * - Supports fallbackSrc: if primary image fails, tries fallbackSrc before showing broken <img>
 * Falls back to a plain <img> tag for unconfigured/failing hosts.
 */
export function SafeImage({ alt, fallbackSrc, ...props }: ImageProps & { fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false);
  const [useFallbackSrc, setUseFallbackSrc] = useState(false);

  let src = typeof props.src === 'string' ? props.src : '';

  // Some RSS feeds return artwork as a JSON array string e.g. '["https://..."]'
  if (src.startsWith('[')) {
    try {
      const parsed = JSON.parse(src);
      src = Array.isArray(parsed) ? parsed[0] || '' : src;
    } catch { /* keep original */ }
  }

  // If primary image failed and we have a fallbackSrc, use it
  if (useFallbackSrc && fallbackSrc) {
    props = { ...props, src: fallbackSrc };
    src = fallbackSrc;
  } else if (src !== props.src) {
    props = { ...props, src };
  }

  const isExternal = src.startsWith('http://') || src.startsWith('https://');

  if (useFallback || (isExternal && !isAllowedHostname(src))) {
    return <ImgFallback alt={alt} {...props} />;
  }

  return (
    <Image
      {...props}
      alt={alt}
      onError={() => {
        if (!useFallbackSrc && fallbackSrc) {
          setUseFallbackSrc(true);
        } else {
          setUseFallback(true);
        }
      }}
    />
  );
}
