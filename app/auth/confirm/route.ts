import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the "Confirm signup" email link. Handles both link formats:
// - ?code=...                    the default Supabase template (PKCE)
// - ?token_hash=...&type=email   the custom template in the README
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code || (tokenHash && type)) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    console.error("Email confirmation failed", error.code, error.message);
  }

  return NextResponse.redirect(new URL("/login?error=confirm", request.url));
}
