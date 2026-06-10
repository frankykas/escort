"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-gray-100"
    >
      <LogOut size={16} className="flex-shrink-0" />
      Sign Out
    </button>
  );
}
