"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("status_updates")
      .delete()
      .eq("id", postId);

    if (!error) {
      router.back();
    } else {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="text-[12px] font-medium text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Delete
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
      title="Delete post"
    >
      <Trash2 size={16} />
    </button>
  );
}
