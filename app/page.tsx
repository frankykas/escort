import { redirect } from "next/navigation";
import { ClassicHome } from "@/components/classic/ClassicHome";
import { ProviderDashboard } from "@/components/provider/ProviderDashboard";
import { createServerClient } from "@/lib/supabase/server";

export default async function Page() {
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

  return <ClassicHome />;
}
