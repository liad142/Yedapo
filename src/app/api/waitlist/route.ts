import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/cache";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Rate limit: 5/min per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`waitlist:${ip}`, 5, 60);
  if (!rlAllowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  if (email.length > 254) {
    return NextResponse.json({ error: "Email too long" }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("waitlist").upsert({ email }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: "Failed to join" }, { status: 500 });

  return NextResponse.json({ success: true });
}
