import { USE_SOCIAL_FEED } from "@/lib/features";
import { ClassicHome } from "@/components/classic/ClassicHome";
import { SocialHome } from "@/components/social/SocialHome";
import { ProviderDashboard } from "@/components/provider/ProviderDashboard";
import { createServerClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

/**
 * Home page — Server Component.
 *
 * Routing logic (server-side, no client flicker):
 *   authenticated provider  → ProviderDashboard
 *   authenticated client    → SocialHome / ClassicHome (feature flag)
 *   unauthenticated         → SocialHome / ClassicHome (feature flag)
 *
 * The DB call is a single PK lookup on `profiles` — fast and idempotent.
 * Only runs for authenticated users; anonymous visitors skip it entirely.
 */
export default async function Page({ searchParams }: Props) {
  const supabase = createServerClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_provider")
        .eq("id", user.id)
        .single();

      if (profile?.is_provider) {
        return <ProviderDashboard />;
      }
    }
  }

  return USE_SOCIAL_FEED ? (
    <SocialHome searchParams={searchParams} />
  ) : (
    <ClassicHome />
  );
}
