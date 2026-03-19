export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SECRET_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'GOOGLE_GEMINI_API_KEY',
    ];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length > 0) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'STARTUP FAILED: Missing required environment variables',
          missing,
          timestamp: new Date().toISOString(),
        })
      );
      process.exit(1);
    }
  }
}
