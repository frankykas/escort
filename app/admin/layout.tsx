"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, checked } = useSession();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!checked) return;

    if (!user) {
      router.replace("/auth/signin");
      return;
    }

    // Check admin status via API
    fetch(`/api/admin/auth?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isAdmin) {
          setAuthorized(true);
        } else {
          router.replace("/");
        }
        setChecking(false);
      })
      .catch(() => {
        router.replace("/");
        setChecking(false);
      });
  }, [user, checked, router]);

  if (!checked || checking || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return <>{children}</>;
}
