"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Bookmark, MapPin, Clock, Loader2, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  rate: number | null;
  duration_minutes: number | null;
  service_type: string | null;
  cover_url: string | null;
  city: string | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

function formatRate(rate: number | null, mins: number | null) {
  if (!rate) return null;
  const cad = `CA$${Math.round(rate / 100)}`;
  if (!mins) return cad;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const dur = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  return `${cad} / ${dur}`;
}

export default function LikedPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem("saved_listings") ?? "[]");
    if (!ids.length) { setLoading(false); return; }
    supabase
      .from("listings")
      .select("id, title, rate, duration_minutes, service_type, cover_url, city, profiles!provider_id(username, avatar_url)")
      .in("id", ids)
      .then(({ data }) => {
        setListings((data as unknown as Listing[]) ?? []);
        setLoading(false);
      });
  }, []);

  function unsave(id: string) {
    const current: string[] = JSON.parse(localStorage.getItem("saved_listings") ?? "[]");
    localStorage.setItem("saved_listings", JSON.stringify(current.filter((x) => x !== id)));
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Saved Listings</span>
        {listings.length > 0 && (
          <span className="ml-auto rounded-full bg-zinc-800 px-2.5 py-0.5 text-[12px] text-zinc-400">
            {listings.length}
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/60">
            <Bookmark size={32} className="text-zinc-600" />
          </div>
          <p className="text-[16px] font-semibold text-white">No saved listings yet</p>
          <p className="text-[13px] text-zinc-500">Tap the heart icon on any listing to save it here.</p>
          <Link
            href="/explore"
            className="mt-2 rounded-full bg-amber-400 px-6 py-2.5 text-[14px] font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg divide-y divide-white/5">
          {listings.map((listing) => {
            const rateStr = formatRate(listing.rate, listing.duration_minutes);
            return (
              <div key={listing.id} className="relative flex gap-4 px-4 py-4">
                {/* Thumbnail */}
                <Link href={`/listings/${listing.id}`} className="flex-shrink-0">
                  <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-zinc-800">
                    {listing.cover_url ? (
                      <Image src={listing.cover_url} alt={listing.title} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Bookmark size={20} className="text-zinc-600" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Details */}
                <Link href={`/listings/${listing.id}`} className="flex-1 min-w-0">
                  {listing.service_type && (
                    <span className="mb-1 inline-block rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      {listing.service_type}
                    </span>
                  )}
                  <p className="text-[14px] font-semibold text-white line-clamp-2 leading-snug">
                    {listing.title}
                  </p>
                  {listing.profiles?.username && (
                    <p className="mt-1 text-[12px] text-zinc-500">@{listing.profiles.username}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-zinc-500">
                    {rateStr && (
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <Clock size={11} />
                        {rateStr}
                      </span>
                    )}
                    {listing.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {listing.city}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Unsave button */}
                <button
                  onClick={() => unsave(listing.id)}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 transition hover:bg-zinc-700"
                  aria-label="Unsave"
                >
                  <Heart size={14} className="fill-rose-500 text-rose-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
