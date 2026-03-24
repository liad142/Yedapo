import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('channel_name, description, thumbnail_url')
    .eq('id', id)
    .single();

  if (!channel) {
    return { title: 'Channel Not Found — Yedapo' };
  }

  const title = `${channel.channel_name} — Yedapo`;
  const description =
    channel.description?.substring(0, 200) ||
    `Watch ${channel.channel_name} videos with AI-powered summaries and insights.`;

  return {
    title,
    description,
    openGraph: {
      title: channel.channel_name,
      description,
      type: 'website',
      siteName: 'Yedapo',
      ...(channel.thumbnail_url && {
        images: [{ url: channel.thumbnail_url, alt: channel.channel_name }],
      }),
    },
    twitter: {
      card: 'summary',
      title: channel.channel_name,
      description,
      ...(channel.thumbnail_url && { images: [channel.thumbnail_url] }),
    },
  };
}

export default function YouTubeChannelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
