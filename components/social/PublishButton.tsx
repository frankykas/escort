"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { DEV_SHOW_POST_BUTTON } from "@/lib/features";
import { CreateStatusDrawer } from "./CreateStatusDrawer";

type ProviderStatus = {
  isVerifiedProvider: boolean;
  checked: boolean;
};

export function PublishButton() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [{ isVerifiedProvider, checked }, setProviderStatus] =
    useState<ProviderStatus>({ isVerifiedProvider: false, checked: false });

  useEffect(() => {
    // Skip the DB check entirely in dev mode
    if (DEV_SHOW_POST_BUTTON) {
      setProviderStatus({ isVerifiedProvider: true, checked: true });
      return;
    }

    if (loading) return;
    if (!user) {
      setProviderStatus({ isVerifiedProvider: false, checked: true });
      return;
    }

    supabase
      .from("profiles")
      .select("is_provider, verification_status")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setProviderStatus({
          isVerifiedProvider:
            !!data?.is_provider && data?.verification_status === "verified",
          checked: true,
        });
      });
  }, [user, loading]);

  if (!checked || !isVerifiedProvider) return null;

  function handlePublished() {
    setDrawerOpen(false);
    router.refresh();
  }

  return (
    <>
      <motion.button
        onClick={() => setDrawerOpen(true)}
        aria-label="Create new status"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-950 shadow-2xl shadow-black/40 transition-colors hover:bg-zinc-100 active:scale-95"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300, delay: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </motion.button>

      <AnimatePresence>
        {drawerOpen && (
          <CreateStatusDrawer
            userId={user?.id ?? ""}
            onClose={() => setDrawerOpen(false)}
            onPublished={handlePublished}
          />
        )}
      </AnimatePresence>
    </>
  );
}
