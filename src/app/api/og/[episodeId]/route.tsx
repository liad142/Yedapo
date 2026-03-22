import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
import type { QuickSummaryContent } from '@/types/database';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;

  // Fetch episode + podcast + quick summary
  const supabase = createAdminClient();

  const [{ data: episode }, { data: summary }] = await Promise.all([
    supabase
      .from('episodes')
      .select('title, published_at, duration_seconds, podcasts(title, image_url)')
      .eq('id', episodeId)
      .single(),
    supabase
      .from('summaries')
      .select('content_json')
      .eq('episode_id', episodeId)
      .eq('level', 'quick')
      .eq('status', 'ready')
      .single(),
  ]);

  if (!episode) {
    return new Response('Episode not found', { status: 404 });
  }

  const podcastRaw = episode.podcasts;
  const podcast = (Array.isArray(podcastRaw) ? podcastRaw[0] : podcastRaw) as { title: string; image_url: string | null } | null;
  const quick = summary?.content_json as QuickSummaryContent | null;

  const title = episode.title || 'Untitled Episode';
  const podcastName = podcast?.title || 'Unknown Podcast';
  const hookHeadline = quick?.hook_headline || '';
  const tags = quick?.tags?.slice(0, 4) || [];
  const artworkUrl = podcast?.image_url;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(145deg, #0a0a0f 0%, #0f1729 40%, #0a1628 100%)',
          padding: 0,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid texture */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.04,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Accent glow */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: -80,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,163,209,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            padding: '48px 56px',
          }}
        >
          {/* Top: podcast info + artwork */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {artworkUrl ? (
              <img
                src={artworkUrl}
                width={64}
                height={64}
                style={{
                  borderRadius: 14,
                  objectFit: 'cover',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 28,
                }}
              >
                🎙
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  color: '#38a3d1',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                }}
              >
                {podcastName.length > 50
                  ? podcastName.substring(0, 47) + '...'
                  : podcastName}
              </span>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>
                Episode Insights
              </span>
            </div>
          </div>

          {/* Middle: title + quote */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              flex: 1,
              justifyContent: 'center',
              paddingTop: 16,
              paddingBottom: 16,
            }}
          >
            <h1
              style={{
                fontSize: title.length > 80 ? 36 : title.length > 50 ? 42 : 48,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.15,
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              {title.length > 100
                ? title.substring(0, 97) + '...'
                : title}
            </h1>

            {hookHeadline && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 3,
                    height: '100%',
                    minHeight: 30,
                    background: 'linear-gradient(180deg, #38a3d1 0%, rgba(56,163,209,0.3) 100%)',
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 22,
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: 1.4,
                    fontStyle: 'italic',
                  }}
                >
                  {hookHeadline.length > 120
                    ? hookHeadline.substring(0, 117) + '...'
                    : hookHeadline}
                </span>
              </div>
            )}
          </div>

          {/* Bottom: tags + branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Tags */}
            <div style={{ display: 'flex', gap: 8 }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 14,
                    color: 'rgba(56,163,209,0.9)',
                    background: 'rgba(56,163,209,0.1)',
                    border: '1px solid rgba(56,163,209,0.2)',
                    borderRadius: 20,
                    padding: '6px 14px',
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: '-0.02em',
                }}
              >
                Yedapo
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.35)',
                  borderLeft: '1px solid rgba(255,255,255,0.15)',
                  paddingLeft: 10,
                }}
              >
                Know what matters
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
