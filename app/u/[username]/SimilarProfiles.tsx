"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

type SimilarProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  city: string | null;
  age: number | null;
  verification_status: string | null;
  tagline: string | null;
};

type Props = {
  profileId: string;
  city: string | null;
  serviceCategories: string[];
};

export function SimilarProfiles({ profileId, city, serviceCategories }: Props) {
  const [profiles, setProfiles] = useState<SimilarProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      // Try to find providers in the same city first, fall back to any providers
      let query = supabase
        .from("profiles")
        .select("id, username, avatar_url, city, age, verification_status, tagline")
        .eq("is_provider", true)
        .neq("id", profileId)
        .limit(12);

      if (city) {
        query = query.eq("city", city);
      }

      const { data } = await query;

      let results = data ?? [];

      // If we got fewer than 4 from same city, backfill with other providers
      if (results.length < 4 && city) {
        const existingIds = [profileId, ...results.map((p) => p.id)];
        const { data: more } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, city, age, verification_status, tagline")
          .eq("is_provider", true)
          .not("id", "in", `(${existingIds.join(",")})`)
          .limit(12 - results.length);
        results = [...results, ...(more ?? [])];
      }

      setProfiles(results);
      setLoading(false);
    }

    fetch();
  }, [profileId, city, serviceCategories]);

  if (loading || profiles.length === 0) return null;

  return (
    <div className="mt-6 px-4 pb-4">
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-zinc-500">
        Similar profiles
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {profiles.map((p) => {
          const isVerified = p.verification_status === "verified";
          return (
            <Link
              key={p.id}
              href={`/u/${p.username}`}
              className="flex-shrink-0"
            >
              <div className="w-[140px] rounded-2xl border border-white/5 bg-zinc-900/60 p-3 transition-all hover:border-white/10">
                {/* Avatar */}
                <div className="relative mx-auto mb-2 h-20 w-20 overflow-hidden rounded-full">
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt={p.username}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-lg font-bold text-zinc-400">
                      {p.username[0].toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name + verified */}
                <div className="flex items-center justify-center gap-1">
                  <span className="truncate text-[13px] font-semibold text-white">
                    {p.username}
                  </span>
                  {isVerified && (
                    <CheckCircle size={11} className="flex-shrink-0 fill-amber-400/20 text-amber-400" />
                  )}
                </div>

                {/* City + age */}
                {(p.city || p.age) && (
                  <div className="mt-1 flex items-center justify-center gap-1 text-zinc-500">
                    {p.city && <MapPin size={10} className="flex-shrink-0" />}
                    <span className="truncate text-[11px]">
                      {[p.city, p.age ? `${p.age}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                )}

                {/* Tagline */}
                {p.tagline && (
                  <p className="mt-1.5 line-clamp-2 text-center text-[10px] leading-snug text-zinc-500">
                    {p.tagline}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
