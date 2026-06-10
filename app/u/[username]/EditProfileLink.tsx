"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export function EditProfileLink({ profileId }: { profileId: string }) {
  const { user } = useSession();

  if (!user || user.id !== profileId) return null;

  return (
    <Link
      href="/profile/edit"
      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-semibold text-slate-800 transition-colors hover:bg-gray-100"
    >
      <Pencil size={13} />
      Edit Profile
    </Link>
  );
}
