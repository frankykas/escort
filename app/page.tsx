import { redirect } from "next/navigation";
import { USE_SOCIAL_FEED } from "@/lib/features";
import { ClassicHome } from "@/components/classic/ClassicHome";
import { SocialHome } from "@/components/social/SocialHome";
import { ProviderDashboard } from "@/components/provider/ProviderDashboard";
import { createServerClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const supabase = createServerClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_provider, onboarding_completed")
        .eq("id", user.id)
        .single();

      if (profile && !profile.onboarding_completed) {
        redirect("/onboarding");
      }

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
