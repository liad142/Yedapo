'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h2>Something went wrong</h2>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '1rem', 
          borderRadius: '8px',
          fontSize: '13px',
          overflow: 'auto',
          maxWidth: '100%',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
