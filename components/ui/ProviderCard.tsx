"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProviderCardData = {
  id: string;
  username: string;
  avatar_url: string | null;
  city: string | null;
  age: number | null;
  verification_status: string | null;
  tagline: string | null;
  hourly_rate: number | null;
  available_until: string | null;
};

type Props = {
  provider: ProviderCardData;
};

export function ProviderCard({ provider }: Props) {
  const isVerified = provider.verification_status === "verified";
  const isAvailable = provider.available_until
    ? new Date(provider.available_until) > new Date()
    : false;
  const displayRate = provider.hourly_rate
    ? `$${Math.round(provider.hourly_rate / 100)}`
    : null;

  return (
    <Link href={`/u/${provider.username}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-800">
        {/* Photo */}
        {provider.avatar_url ? (
          <Image
            src={provider.avatar_url}
            alt={provider.username}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-4xl font-bold text-zinc-600">
            {provider.username[0].toUpperCase()}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top badges */}
        <div className="absolute left-2 right-2 top-2 flex items-center justify-between">
          {isVerified && (
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-amber-400 backdrop-blur-md border border-amber-400/20">
              <CheckCircle size={9} className="fill-amber-400/20" />
              Verified
            </span>
          )}
          {isAvailable && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 backdrop-blur-md border border-emerald-500/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[9px] font-semibold text-emerald-400">Available</span>
            </span>
          )}
        </div>

        {/* Rate badge */}
        {displayRate && (
          <div className="absolute right-2 bottom-16 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-md">
            {displayRate}/hr
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold text-white drop-shadow-lg truncate">
              {provider.username}
            </span>
            {provider.age && (
              <span className="text-[14px] font-medium text-white/70">{provider.age}</span>
            )}
          </div>

          {provider.city && (
            <div className="mt-0.5 flex items-center gap-1">
              <MapPin size={10} className="text-white/50" />
              <span className="text-[11px] text-white/60">{provider.city}</span>
            </div>
          )}

          {provider.tagline && (
            <p className="mt-1 line-clamp-1 text-[10px] italic text-white/40">
              {provider.tagline}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
