"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

export function PostMenu({ postId, ownerId }: { postId: string; ownerId: string }) {
  const { user } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Only render for own posts
  if (!user || user.id !== ownerId) return null;

  async function handleDelete() {
    if (!user || deleting) return;
    setDeleting(true);
    const { error } = await supabase
      .from("status_updates")
      .delete()
      .eq("id", postId)
      .eq("provider_id", user.id); // explicit ownership check
    if (!error) {
      router.replace("/profile");
    } else {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setMenuOpen(!menuOpen); setConfirmOpen(false); }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
      >
        <MoreVertical size={18} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setMenuOpen(false); setConfirmOpen(false); }} />
          <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            {confirmOpen ? (
              <div className="p-3 space-y-2">
                <p className="text-[12px] text-slate-700 text-center">Delete this post permanently?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-medium text-slate-500 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-500 py-2 text-[12px] font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-red-500 transition hover:bg-red-50"
              >
                <Trash2 size={14} />
                Delete post
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
