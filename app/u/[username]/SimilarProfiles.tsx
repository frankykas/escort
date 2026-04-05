"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, CheckCircle, Sparkles, ChevronRight } from "lucide-react";
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
    async function load() {
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

    load();
  }, [profileId, city, serviceCategories]);

  if (loading) {
    return (
      <div className="mt-6 px-4 pb-2">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-3 w-32 rounded-full bg-zinc-800 shimmer" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[200px] w-[150px] flex-shrink-0 rounded-2xl bg-zinc-800 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <div className="mt-6 pb-2">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <h3 className="text-[13px] font-bold uppercase tracking-widest text-zinc-400">
            You might also like
          </h3>
        </div>
        <Link
          href="/explore"
          className="flex items-center gap-0.5 text-[12px] font-medium text-amber-400 transition-colors hover:text-amber-300"
        >
          See all
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Scrollable cards */}
      <div
        className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
      >
        {profiles.map((p, i) => {
          const isVerified = p.verification_status === "verified";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Link
                href={`/u/${p.username}`}
                className="group block flex-shrink-0"
              >
                <div className="relative h-[220px] w-[155px] overflow-hidden rounded-2xl bg-zinc-800">
                  {/* Full-bleed photo */}
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt={p.username}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="155px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl font-bold text-zinc-600">
                      {p.username[0].toUpperCase()}
                    </div>
                  )}

                  {/* Gradient overlay — bottom half */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Verified badge — top right */}
                  {isVerified && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 backdrop-blur-md">
                      <CheckCircle size={10} className="fill-amber-400/20 text-amber-400" />
                      <span className="text-[9px] font-semibold text-amber-400">Verified</span>
                    </div>
                  )}

                  {/* Bottom info overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    {/* Name + age */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[14px] font-bold text-white drop-shadow-lg">
                        {p.username}
                      </span>
                      {p.age && (
                        <span className="text-[13px] font-medium text-white/70">
                          {p.age}
                        </span>
                      )}
                    </div>

                    {/* City */}
                    {p.city && (
                      <div className="mt-0.5 flex items-center gap-1">
                        <MapPin size={10} className="text-white/50" />
                        <span className="text-[11px] text-white/60">{p.city}</span>
                      </div>
                    )}

                    {/* Tagline */}
                    {p.tagline && (
                      <p className="mt-1 line-clamp-1 text-[10px] italic leading-snug text-white/50">
                        {p.tagline}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
        {/* End spacer */}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}
