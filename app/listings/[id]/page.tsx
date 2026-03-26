import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle,
  MapPin,
  Clock,
  ChevronLeft,
  Check,
  Phone,
  Users,
  Star,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { EnquireBar } from "../EnquireBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = {
  id: string;
  username: string;
  avatar_url: string | null;
  verification_status: "none" | "pending" | "verified";
  city: string | null;
  age: number | null;
  incall: boolean;
  outcall: boolean;
  followers_count: number;
};

type Listing = {
  id: string;
  provider_id: string;
  provider: Provider;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  rate: number | null;
  perks: string[];
  service_type: string | null;
  is_active: boolean;
  cover_url: string | null;
};

type OtherListing = {
  id: string;
  title: string;
  rate: number | null;
  duration_minutes: number | null;
  service_type: string | null;
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRate(pence: number | null): string {
  if (!pence) return "POA";
  return `CA$${Math.round(pence / 100).toLocaleString()}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "On request";
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 720) return "Overnight";
  if (minutes >= 1440) return `${minutes / 1440} day${minutes > 1440 ? "s" : ""}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} ${h === 1 ? "hour" : "hours"}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  if (!supabase) notFound();

  // Listing + provider in one query
  const { data: raw } = await supabase
    .from("listings")
    .select(
      `id, provider_id, title, description, duration_minutes, rate, perks,
       service_type, is_active, cover_url,
       provider:profiles!provider_id (
         id, username, avatar_url, verification_status,
         city, age, incall, outcall, followers_count
       )`
    )
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!raw) notFound();

  const listing = raw as unknown as Listing;
  const provider = listing.provider;

  // Parallel: other listings + provider posts (for hero image)
  const [otherRes, postsRes] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, rate, duration_minutes, service_type")
      .eq("provider_id", listing.provider_id)
      .eq("is_active", true)
      .neq("id", id)
      .order("sort_order")
      .limit(6),
    supabase
      .from("status_updates")
      .select("media_url")
      .eq("provider_id", listing.provider_id)
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const otherListings = (otherRes.data ?? []) as OtherListing[];
  const heroImage = listing.cover_url ?? (postsRes.data?.[0] as { media_url: string } | undefined)?.media_url ?? null;
  const isVerified = provider.verification_status === "verified";

  return (
    <div className="min-h-screen bg-zinc-950 pb-32">

      {/* ── Hero ── */}
      <div className="relative w-full" style={{ minHeight: "52vw", maxHeight: "520px", height: "65vw" }}>

        {/* Background image or gradient */}
        {heroImage ? (
          <Image
            src={heroImage}
            alt={listing.title}
            fill
            className="object-cover brightness-[0.45]"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/40 via-zinc-900 to-zinc-950" />
        )}

        {/* Gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />

        {/* Back button */}
        <Link
          href="javascript:history.back()"
          className="absolute left-4 top-12 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
        >
          <ChevronLeft size={20} />
        </Link>

        {/* Service type badge */}
        {listing.service_type && (
          <div className="absolute left-1/2 top-14 -translate-x-1/2">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-400 backdrop-blur-md">
              {listing.service_type}
            </span>
          </div>
        )}

        {/* Title + rate */}
        <div className="absolute inset-x-0 bottom-8 px-5">
          <h1 className="mb-2 text-[24px] font-bold leading-tight text-white tracking-tight">
            {listing.title}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-bold text-amber-400 leading-none">
              {formatRate(listing.rate)}
            </span>
            {listing.duration_minutes && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-zinc-300 backdrop-blur-md">
                <Clock size={11} />
                {formatDuration(listing.duration_minutes)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Provider card ── */}
      <div className="relative z-10 -mt-2 mx-4">
        <Link
          href={`/u/${provider.username}`}
          className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-zinc-900/90 px-4 py-3.5 shadow-xl backdrop-blur-xl transition-all hover:border-white/10 active:scale-[0.99]"
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 to-yellow-300">
              <div className="rounded-full p-[1.5px] bg-zinc-900">
                {provider.avatar_url ? (
                  <div className="relative h-11 w-11 overflow-hidden rounded-full">
                    <Image src={provider.avatar_url} alt={provider.username} fill className="object-cover" sizes="44px" />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-base font-bold text-zinc-300">
                    {provider.username[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold text-white truncate">{provider.username}</span>
              {isVerified && <CheckCircle size={12} className="flex-shrink-0 text-amber-400 fill-amber-400/20" />}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
              {provider.city && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={9} />
                  {provider.city}
                </span>
              )}
              {provider.age && <span>{provider.age} yrs</span>}
              <span className="flex items-center gap-0.5">
                <Users size={9} />
                {provider.followers_count.toLocaleString()} followers
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
            View profile
            <ChevronLeft size={12} className="rotate-180" />
          </div>
        </Link>
      </div>

      {/* ── Body content ── */}
      <div className="mt-5 space-y-4 px-4">

        {/* Call type + service tags */}
        <div className="flex flex-wrap gap-2">
          {provider.incall && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/5 bg-zinc-900 px-3.5 py-1.5 text-[12px] font-medium text-zinc-300">
              <Phone size={11} className="text-emerald-400" /> In-call
            </span>
          )}
          {provider.outcall && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/5 bg-zinc-900 px-3.5 py-1.5 text-[12px] font-medium text-zinc-300">
              <MapPin size={11} className="text-sky-400" /> Out-call
            </span>
          )}
          {listing.service_type && (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/5 px-3.5 py-1.5 text-[12px] font-medium text-amber-400">
              <Star size={10} /> {listing.service_type}
            </span>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <div className="rounded-2xl border border-white/5 bg-zinc-900/70 px-4 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">About this service</p>
            <p className="text-[14px] leading-relaxed text-zinc-300">{listing.description}</p>
          </div>
        )}

        {/* What's included */}
        {listing.perks && listing.perks.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-zinc-900/70 px-4 py-4">
            <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">What's included</p>
            <ul className="space-y-2.5">
              {listing.perks.map((perk, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/15">
                    <Check size={10} className="text-amber-400" strokeWidth={3} />
                  </span>
                  <span className="text-[13px] leading-snug text-zinc-300">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Other listings from this provider */}
        {otherListings.length > 0 && (
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              More from @{provider.username}
            </p>
            <div
              className="flex gap-2.5 overflow-x-auto"
              style={{ scrollbarWidth: "none", paddingRight: "1rem" }}
            >
              {otherListings.map((ol) => (
                <Link
                  key={ol.id}
                  href={`/listings/${ol.id}`}
                  className="flex-shrink-0 rounded-2xl border border-white/5 bg-zinc-900/80 p-3.5 transition-all hover:border-white/10 active:scale-[0.98]"
                  style={{ minWidth: "160px", maxWidth: "180px" }}
                >
                  {ol.service_type && (
                    <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-amber-400/70">
                      {ol.service_type}
                    </span>
                  )}
                  <p className="text-[13px] font-semibold leading-tight text-white line-clamp-2">{ol.title}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="font-bold text-amber-400">{formatRate(ol.rate)}</span>
                    {ol.duration_minutes && (
                      <>
                        <span>·</span>
                        <span>{formatDuration(ol.duration_minutes)}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
              <div className="w-1 flex-shrink-0" />
            </div>
          </div>
        )}

      </div>

      {/* ── Sticky bottom bar ── */}
      <EnquireBar username={provider.username} rate={listing.rate} duration={listing.duration_minutes} />
    </div>
  );
}
