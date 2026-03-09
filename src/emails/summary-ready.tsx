import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from '@react-email/components';
import type { ShareContent } from '@/types/notifications';

export function SummaryReadyEmail({
  episodeTitle,
  podcastName,
  hookHeadline,
  highlights,
  insightsUrl,
}: ShareContent) {
  return (
    <Html>
      <Head />
      <Preview>{hookHeadline}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Yedapo</Text>
          </Section>

          {/* Episode info */}
          <Section style={main}>
            <Text style={heading}>Your episode summary is ready</Text>
            <Text style={episodeTitleStyle}>{episodeTitle}</Text>
            <Text style={podcastNameStyle}>{podcastName}</Text>

            <Hr style={divider} />

            {/* Hook headline */}
            <Text style={hookStyle}>{hookHeadline}</Text>

            {/* Highlights */}
            {highlights.length > 0 && (
              <>
                <Text style={highlightsLabel}>Key highlights</Text>
                {highlights.map((h, i) => (
                  <Text key={i} style={highlightItem}>
                    &bull; {h}
                  </Text>
                ))}
              </>
            )}

            {/* CTA */}
            <Section style={ctaSection}>
              <Button style={ctaButton} href={insightsUrl}>
                Read Full Insights
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Sent by Yedapo &mdash; Your podcast insights companion
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const body = {
  backgroundColor: '#f6f6f6',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: '0',
  padding: '0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '580px',
  borderRadius: '8px',
  overflow: 'hidden' as const,
};

const header = {
  backgroundColor: '#111827',
  padding: '24px 32px',
};

const logo = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700' as const,
  margin: '0',
};

const main = {
  padding: '32px',
};

const heading = {
  color: '#6b7280',
  fontSize: '13px',
  fontWeight: '500' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 16px',
};

const episodeTitleStyle = {
  color: '#111827',
  fontSize: '22px',
  fontWeight: '700' as const,
  lineHeight: '1.3',
  margin: '0 0 4px',
};

const podcastNameStyle = {
  color: '#6b7280',
  fontSize: '15px',
  margin: '0 0 24px',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '0 0 24px',
};

const hookStyle = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '600' as const,
  lineHeight: '1.4',
  margin: '0 0 24px',
};

const highlightsLabel = {
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 8px',
};

const highlightItem = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  paddingLeft: '4px',
};

const ctaSection = {
  textAlign: 'center' as const,
  marginTop: '32px',
};

const ctaButton = {
  backgroundColor: '#111827',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  padding: '12px 32px',
  textDecoration: 'none',
};

const footer = {
  padding: '24px 32px',
  backgroundColor: '#f9fafb',
};

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0',
};

export default SummaryReadyEmail;
