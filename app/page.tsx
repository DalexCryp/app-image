import { SiteHeader } from "@/components/site-header";
import { TryOn } from "@/components/try-on";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // proxy.ts already redirects signed-out visitors; this only reads the name for the header.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const fullName = data?.claims.user_metadata?.full_name;

  return (
    <div className="min-h-screen">
      <SiteHeader userName={typeof fullName === "string" ? fullName : null} />
      <TryOn />
    </div>
  );
}
