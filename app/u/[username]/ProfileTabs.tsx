"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
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
  Calendar,
  Users,
  ExternalLink,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PostModal } from "@/components/social/PostModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORIES } from "@/lib/categories";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PostItem = {
  id: string;
  media_url: string | null;
  blur_url?: string | null;
  is_premium?: boolean;
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

export type AvailabilitySchedule = {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
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
  gender: string | null;
  pronouns: string | null;
  caters_to: string[];
  availability_schedule: AvailabilitySchedule | null;
  hip_size?: string | null;
  bust_size?: string | null;
  bra_cup_size?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  social_links?: Record<string, string | null>;
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "posts", label: t("tab_posts"), icon: Grid3X3, count: posts.length },
    ...(isProvider ? [
      { id: "listings" as Tab, label: t("tab_listings"), icon: ListOrdered, count: listings.length },
    ] : []),
    { id: "about", label: t("tab_about"), icon: User },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
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
                  ? "border-b-2 border-pink-400 text-slate-800"
                  : "text-slate-400 hover:text-slate-500"
              )}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 1.8} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[9px] font-bold",
                    active ? "bg-pink-50 text-pink-500" : "bg-gray-100 text-slate-400"
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
      {activeTab === "posts" && <PostsGrid posts={posts} isOwnProfile={isOwnProfile} />}
      {activeTab === "listings" && (
        <ListingsTab listings={listings} isOwnProfile={isOwnProfile} serviceCategories={attributes.service_categories} />
      )}
      {activeTab === "about" && <AboutTab attributes={attributes} />}
    </div>
  );
}

// ─── Posts grid ───────────────────────────────────────────────────────────────

function PostsGrid({ posts, isOwnProfile }: { posts: PostItem[]; isOwnProfile: boolean }) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  if (posts.length === 0) {
    return <EmptyState variant="no-posts" isOwnProfile={isOwnProfile} />;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => setSelectedPostId(post.id)}
            className="group relative aspect-square overflow-hidden bg-gray-50"
          >
            {post.media_url ? (
              <Image
                src={post.media_url}
                alt=""
                fill
                className="object-cover transition-transform duration-200 group-hover:scale-105"
                sizes="(max-width: 768px) 33vw, 200px"
              />
            ) : post.is_premium && post.blur_url ? (
              /* Premium post with server-blurred preview — not CSS blur */
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.blur_url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Lock size={16} className="text-white" />
                </div>
              </div>
            ) : post.is_premium ? (
              /* Premium post without blur preview (legacy) */
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-50 to-sky-50">
                <Lock size={16} className="text-pink-300" />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-50">
                <span className="text-[10px] text-slate-300">No image</span>
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
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedPostId && (
          <PostModal
            postId={selectedPostId}
            onClose={() => setSelectedPostId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Listings tab ─────────────────────────────────────────────────────────────

function ListingsTab({
  listings,
  isOwnProfile,
  serviceCategories,
}: {
  listings: ListingItem[];
  isOwnProfile: boolean;
  serviceCategories: string[];
}) {
  if (listings.length === 0) {
    return <EmptyState variant="no-listings" isOwnProfile={isOwnProfile} />;
  }

  // Match provider's service_categories to browsable category slugs
  const matchedCategories = CATEGORIES.filter((cat) => {
    if (cat.filter.type === "service" || cat.filter.type === "tag") {
      return serviceCategories.includes(String(cat.filter.value));
    }
    return false;
  });

  return (
    <div className="space-y-2.5 px-4 py-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} categories={matchedCategories} />
      ))}
    </div>
  );
}

function ListingCard({ listing, categories }: { listing: ListingItem; categories: import("@/lib/categories").Category[] }) {
  return (
    <Link href={`/listings/${listing.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-all group-hover:border-gray-300 group-hover:shadow-lg">
        <div className="px-4 pt-4 pb-3">
          {/* Title + rate */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-slate-800 leading-tight flex-1">
              {listing.title}
            </h3>
            <span className="text-[17px] font-bold text-pink-500 flex-shrink-0">
              {formatRate(listing.rate)}
            </span>
          </div>

          {/* Duration */}
          <div className="mt-1.5 flex items-center gap-1 text-slate-400">
            <Clock size={11} className="flex-shrink-0" />
            <span className="text-[12px]">{formatDuration(listing.duration_minutes)}</span>
          </div>

          {/* Description */}
          {listing.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500 line-clamp-2">
              {listing.description}
            </p>
          )}

          {/* Category tags */}
          {categories.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {categories.slice(0, 3).map((cat) => (
                <span
                  key={cat.slug}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block"
                >
                  <Link
                    href={`/category/${cat.slug}`}
                    className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:border-pink-300 hover:text-pink-500"
                  >
                    <span className="text-[11px]">{cat.emoji}</span>
                    {cat.shortLabel}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex w-full items-center justify-center gap-1.5 border-t border-gray-200 py-3 text-[13px] font-semibold text-pink-500 transition-all group-hover:bg-pink-50">
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
    attributes.gender ? { label: "Gender", value: `${attributes.gender}${attributes.pronouns ? ` (${attributes.pronouns})` : ""}` } : null,
    attributes.age ? { label: "Age", value: `${attributes.age}` } : null,
    attributes.height_cm ? { label: "Height", value: heightDisplay(attributes.height_cm) } : null,
    attributes.build ? { label: "Build", value: capitalize(attributes.build) } : null,
    attributes.bust_size ? { label: "Bust", value: attributes.bust_size } : null,
    attributes.hip_size ? { label: "Hips", value: attributes.hip_size } : null,
    attributes.bra_cup_size ? { label: "Cup", value: attributes.bra_cup_size } : null,
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
  const hasCatersTo = attributes.caters_to.length > 0;
  const hasSchedule = attributes.availability_schedule && Object.values(attributes.availability_schedule).some(Boolean);
  const socialLinks = Object.entries(attributes.social_links ?? {}).filter(([, value]) => !!value) as [string, string][];
  const hasContact = !!(attributes.contact_phone || attributes.website_url || socialLinks.length > 0);
  const isEmpty = !hasAttrs && !hasBio && !hasLocation && !hasServices && !hasCatersTo && !hasSchedule && !hasContact;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
        <User size={28} className="text-slate-300" />
        <p className="text-sm text-slate-400">No profile information yet.</p>
      </div>
    );
  }

  const DAYS: { key: keyof NonNullable<typeof attributes.availability_schedule>; label: string }[] = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      {/* Physical attributes */}
      {hasAttrs && (
        <section>
          <SectionLabel>Attributes</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-md">
            {attrs.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-slate-400">{label}</span>
                <span className="text-[13px] font-medium text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Caters to */}
      {hasCatersTo && (
        <section>
          <SectionLabel>Caters to</SectionLabel>
          <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-md">
            <div className="flex items-center gap-2.5">
              <Users size={15} className="flex-shrink-0 text-slate-400" />
              <span className="text-[13px] text-slate-700">
                {attributes.caters_to.join(", ")}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Bio */}
      {hasBio && (
        <section>
          <SectionLabel>About me</SectionLabel>
          <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-md">
            <p className="text-[14px] leading-relaxed text-slate-600">
              {attributes.bio_long || attributes.bio}
            </p>
          </div>
        </section>
      )}

      {/* Services */}
      {hasServices && (
        <section>
          <SectionLabel>Services</SectionLabel>
          <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-md space-y-3">
            {attributes.hourly_rate !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-400">Starting rate</span>
                <span className="text-[15px] font-semibold text-pink-500">{formatRate(attributes.hourly_rate)}/hr</span>
              </div>
            )}
            {attributes.service_categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attributes.service_categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border border-pink-300 bg-pink-50 px-3 py-1 text-[12px] font-medium text-pink-500"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Contact and socials */}
      {hasContact && (
        <section>
          <SectionLabel>Contact</SectionLabel>
          <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-md">
            <div className="grid gap-2 sm:grid-cols-2">
              {attributes.contact_phone && (
                <a href={`tel:${attributes.contact_phone}`} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                  <Phone size={14} className="text-slate-400" />
                  Phone
                </a>
              )}
              {attributes.website_url && (
                <a href={normalizeUrl(attributes.website_url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                  <ExternalLink size={14} className="text-slate-400" />
                  Website
                </a>
              )}
              {socialLinks.map(([label, url]) => (
                <a key={label} href={normalizeUrl(url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                  <ExternalLink size={14} className="text-pink-400" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Weekly availability schedule */}
      {hasSchedule && attributes.availability_schedule && (
        <section>
          <SectionLabel>Availability</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-md">
            {DAYS.map(({ key, label }) => {
              const val = attributes.availability_schedule![key];
              if (!val) return null;
              const isUnavailable = val.toLowerCase() === "unavailable";
              return (
                <div key={key} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={13} className="flex-shrink-0 text-slate-300" />
                    <span className="text-[13px] font-medium text-slate-600">{label}</span>
                  </div>
                  <span className={cn(
                    "text-[13px]",
                    isUnavailable ? "text-slate-300" : "text-slate-700 font-medium"
                  )}>
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Location & availability */}
      {hasLocation && (
        <section>
          <SectionLabel>Location & availability</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-md">
            {attributes.city && (
              <div className="flex items-center gap-3 px-4 py-3">
                <MapPin size={15} className="flex-shrink-0 text-slate-400" />
                <span className="text-[13px] text-slate-700">
                  {attributes.city}
                  {attributes.country_code ? `, ${attributes.country_code.toUpperCase()}` : ""}
                </span>
              </div>
            )}
            {(attributes.incall || attributes.outcall) && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone size={15} className="flex-shrink-0 text-slate-400" />
                <span className="text-[13px] text-slate-700">
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
    <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
