import YouTubeChannelClient from './YouTubeChannelClient';

export default async function YouTubeChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: channelId } = await params;

  return <YouTubeChannelClient channelId={channelId} />;
}
