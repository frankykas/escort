"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Grid3X3,
  ListOrdered,
  User,
  Heart,
  MessageCircle,
  Clock,
  MapPin,
  Phone,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PostItem = {
  id: string;
  media_url: string | null;
  likes_count: number;
  comments_count: number;
};

export type ListingItem = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  rate: number; // pence
  sort_order: number;
};

export type ProfileAttributes = {
  bio: string | null;
  bio_long: string | null;
  height_cm: number | null;
  build: string | null;
  hair_color: string | null;
  eye_color: string | null;
  nationality: string | null;
  languages: string[];
  city: string | null;
  country_code: string | null;
  incall: boolean;
  outcall: boolean;
  age: number | null;
  service_categories: string[];
  hourly_rate: number | null;
};

type Tab = "posts" | "listings" | "about";

type Props = {
  posts: PostItem[];
  listings: ListingItem[];
  attributes: ProfileAttributes;
  isOwnProfile: boolean;
  isProvider?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatRate(pence: number): string {
  const amount = Math.round(pence / 100);
  return `CA$${amount.toLocaleString()}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "On request";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}hr`;
}

function heightDisplay(cm: number | null): string {
  if (!cm) return "";
  const totalIn = Math.round(cm / 2.54);
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  return `${ft}'${inches}" (${cm}cm)`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileTabs({ posts, listings, attributes, isOwnProfile, isProvider = true }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "posts", label: "Posts", icon: Grid3X3, count: posts.length },
    ...(isProvider ? [
      { id: "listings" as Tab, label: "Listings", icon: ListOrdered, count: listings.length },
    ] : []),
    { id: "about", label: "About", icon: User },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-white/5 bg-zinc-950">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] font-semibold uppercase tracking-wider transition-colors",
                active
                  ? "border-b-2 border-amber-400 text-white"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 1.8} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[9px] font-bold",
                    active ? "bg-amber-400/20 text-amber-400" : "bg-zinc-800 text-zinc-500"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "posts" && <PostsGrid posts={posts} />}
      {activeTab === "listings" && (
        <ListingsTab listings={listings} isOwnProfile={isOwnProfile} />
      )}
      {activeTab === "about" && <AboutTab attributes={attributes} />}
    </div>
  );
}

// ─── Posts grid ───────────────────────────────────────────────────────────────

function PostsGrid({ posts }: { posts: PostItem[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-zinc-600">No posts yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[1px] bg-zinc-800/50">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/post/${post.id}`}
          className="group relative aspect-square overflow-hidden bg-zinc-900"
        >
          {post.media_url ? (
            <Image
              src={post.media_url}
              alt=""
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 33vw, 200px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900">
              <span className="text-[10px] text-zinc-700">No image</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="flex items-center gap-1 text-xs font-semibold text-white">
              <Heart size={13} className="fill-white" />
              {formatCount(post.likes_count)}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-white">
              <MessageCircle size={13} className="fill-white" />
              {formatCount(post.comments_count)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Listings tab ─────────────────────────────────────────────────────────────

function ListingsTab({
  listings,
  isOwnProfile,
}: {
  listings: ListingItem[];
  isOwnProfile: boolean;
}) {
  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
        <ListOrdered size={28} className="text-zinc-700" />
        <p className="text-[15px] font-medium text-zinc-400">
          {isOwnProfile ? "You haven't added any listings yet." : "No listings yet."}
        </p>
        {isOwnProfile && (
          <Link
            href="/profile/listings"
            className="mt-2 rounded-full bg-amber-400 px-5 py-2 text-[13px] font-semibold text-zinc-950 transition-all hover:bg-amber-300 active:scale-[0.98]"
          >
            Add your first listing
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5 px-4 py-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

function ListingCard({ listing }: { listing: ListingItem }) {
  return (
    <Link href={`/listings/${listing.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-md transition-all group-hover:border-white/10 group-hover:shadow-lg">
        <div className="px-4 pt-4 pb-3">
          {/* Title + rate */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-white leading-tight flex-1">
              {listing.title}
            </h3>
            <span className="text-[17px] font-bold text-amber-400 flex-shrink-0">
              {formatRate(listing.rate)}
            </span>
          </div>

          {/* Duration */}
          <div className="mt-1.5 flex items-center gap-1 text-zinc-500">
            <Clock size={11} className="flex-shrink-0" />
            <span className="text-[12px]">{formatDuration(listing.duration_minutes)}</span>
          </div>

          {/* Description */}
          {listing.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-400 line-clamp-2">
              {listing.description}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex w-full items-center justify-center gap-1.5 border-t border-white/5 py-3 text-[13px] font-semibold text-amber-400 transition-all group-hover:bg-amber-400/5">
          View details
          <ChevronRight size={14} />
        </div>
      </div>
    </Link>
  );
}

// ─── About tab ────────────────────────────────────────────────────────────────

function AboutTab({ attributes }: { attributes: ProfileAttributes }) {
  const attrs: { label: string; value: string }[] = [
    attributes.age ? { label: "Age", value: `${attributes.age}` } : null,
    attributes.height_cm ? { label: "Height", value: heightDisplay(attributes.height_cm) } : null,
    attributes.build ? { label: "Build", value: capitalize(attributes.build) } : null,
    attributes.hair_color ? { label: "Hair", value: capitalize(attributes.hair_color) } : null,
    attributes.eye_color ? { label: "Eyes", value: capitalize(attributes.eye_color) } : null,
    attributes.nationality ? { label: "Nationality", value: attributes.nationality } : null,
    attributes.languages.length > 0
      ? { label: "Languages", value: attributes.languages.join(", ") }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const hasAttrs = attrs.length > 0;
  const hasBio = !!(attributes.bio_long || attributes.bio);
  const hasLocation = !!(attributes.city || attributes.incall || attributes.outcall);
  const hasServices = attributes.service_categories.length > 0 || attributes.hourly_rate !== null;
  const isEmpty = !hasAttrs && !hasBio && !hasLocation && !hasServices;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
        <User size={28} className="text-zinc-700" />
        <p className="text-sm text-zinc-600">No profile information yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      {/* Physical attributes */}
      {hasAttrs && (
        <section>
          <SectionLabel>Attributes</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 divide-y divide-white/5 shadow-md">
            {attrs.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-zinc-500">{label}</span>
                <span className="text-[13px] font-medium text-zinc-100">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bio */}
      {hasBio && (
        <section>
          <SectionLabel>About me</SectionLabel>
          <div className="mt-2 rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-4 shadow-md">
            <p className="text-[14px] leading-relaxed text-zinc-300">
              {attributes.bio_long || attributes.bio}
            </p>
          </div>
        </section>
      )}

      {/* Services */}
      {hasServices && (
        <section>
          <SectionLabel>Services</SectionLabel>
          <div className="mt-2 rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-4 shadow-md space-y-3">
            {attributes.hourly_rate !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-zinc-500">Starting rate</span>
                <span className="text-[15px] font-semibold text-amber-400">{formatRate(attributes.hourly_rate)}/hr</span>
              </div>
            )}
            {attributes.service_categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attributes.service_categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[12px] font-medium text-amber-400"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Location & availability */}
      {hasLocation && (
        <section>
          <SectionLabel>Location & availability</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 divide-y divide-white/5 shadow-md">
            {attributes.city && (
              <div className="flex items-center gap-3 px-4 py-3">
                <MapPin size={15} className="flex-shrink-0 text-zinc-500" />
                <span className="text-[13px] text-zinc-100">
                  {attributes.city}
                  {attributes.country_code ? `, ${attributes.country_code.toUpperCase()}` : ""}
                </span>
              </div>
            )}
            {(attributes.incall || attributes.outcall) && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone size={15} className="flex-shrink-0 text-zinc-500" />
                <span className="text-[13px] text-zinc-100">
                  {[attributes.incall && "In-call", attributes.outcall && "Out-call"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </p>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
