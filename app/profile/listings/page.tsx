"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  ArrowLeft, Plus, Pencil, Trash2, Clock, X, Check,
  ListOrdered, ExternalLink, Coins, ShoppingBag,
  Timer, RefreshCw, Loader2, Megaphone, Sparkles, Star,
  Zap, Eye, Users, Rss, ImagePlus, GripVertical, CalendarDays, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingImage = {
  id: string;
  url: string;
  sort_order: number;
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  rate: number;
  is_active: boolean;
  sort_order: number;
  service_type: string | null;
  perks: string[];
  expires_at: string;
  scheduled_at?: string | null;
  images?: ListingImage[];
};

type FormData = {
  title: string;
  description: string;
  duration_minutes: string;
  rate_pounds: string;
  service_type: string;
  perks_text: string;
  scheduled_at: string;
};

const EMPTY_FORM: FormData = {
  title: "", description: "", duration_minutes: "",
  rate_pounds: "", service_type: "", perks_text: "", scheduled_at: "",
};

const SERVICE_TYPE_KEYS: { value: string; labelKey: TranslationKey }[] = [
  { value: "Companionship", labelKey: "svc_companionship" },
  { value: "Dinner Date",   labelKey: "svc_dinner_date" },
  { value: "Travel",        labelKey: "svc_travel" },
  { value: "GFE",           labelKey: "svc_gfe" },
  { value: "Couples",       labelKey: "svc_couples" },
  { value: "Massage",       labelKey: "svc_massage" },
  { value: "Domination",    labelKey: "svc_domination" },
];

const DURATION_PRESET_KEYS: { labelKey: TranslationKey; value: string }[] = [
  { labelKey: "lf_dur_on_request", value: "" },
  { labelKey: "lf_dur_30",         value: "30" },
  { labelKey: "lf_dur_1h",         value: "60" },
  { labelKey: "lf_dur_90",         value: "90" },
  { labelKey: "lf_dur_2h",         value: "120" },
  { labelKey: "lf_dur_4h",         value: "240" },
  { labelKey: "lf_dur_overnight",  value: "720" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRate(pence: number): string {
  return `CA$${Math.round(pence / 100).toLocaleString()}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes === 720) return "Overnight"; // translated at render time
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}hr`;
}

function avgRate(listings: Listing[]): string {
  const active = listings.filter((l) => l.is_active && l.rate > 0);
  if (!active.length) return "—";
  const avg = active.reduce((s, l) => s + l.rate, 0) / active.length;
  return `CA$${Math.round(avg / 100)}`;
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return `${days}d ${h}h left`;
  }
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: sessionLoading } = useSession();
  const [listings, setListings]         = useState<Listing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [formData, setFormData]         = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError]       = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditConfirm, setCreditConfirm] = useState<{ action: "create" | "relist"; listingId?: string } | null>(null);
  const [bumpDrawer, setBumpDrawer] = useState<{ listingId: string; listingTitle: string } | null>(null);
  const [bumpingTier, setBumpingTier] = useState<number | null>(null);
  const [activeBumps, setActiveBumps] = useState<Record<string, { tier: number; expires_at: string }>>({});
  const [starDrawer, setStarDrawer] = useState<{ listingId: string; listingTitle: string } | null>(null);
  const [starring, setStarring] = useState(false);
  const [starSlots, setStarSlots] = useState<{ active_count: number; max_slots: number; slots_available: number; next_available: string | null } | null>(null);
  const [activeStars, setActiveStars] = useState<Record<string, { expires_at: string }>>({});
  const [pendingImages, setPendingImages] = useState<{ file?: File; url: string; id?: string }[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsPromptOpen, setTermsPromptOpen] = useState(false);
  // Launch promo: all listings are free.
  // Kept as a constant (instead of `listings.length === 0`) so the existing
  // `isFirstListing` branches everywhere render the free-flow path.
  const isFirstListing = true;

  const fetchListings = useCallback(async (userId: string) => {
    const [listingsResult, balanceResult, bumpsResult, imagesResult, starsResult] = await Promise.all([
      supabase
        .from("listings")
        .select("id, title, description, duration_minutes, rate, is_active, sort_order, service_type, perks, expires_at, scheduled_at")
        .eq("provider_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("post_credits_balance")
        .eq("id", userId)
        .single(),
      supabase
        .from("listing_bumps")
        .select("listing_id, tier, expires_at")
        .eq("provider_id", userId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString()),
      supabase
        .from("listing_images")
        .select("id, listing_id, url, sort_order")
        .eq("provider_id", userId)
        .order("sort_order"),
      supabase
        .from("listing_stars")
        .select("listing_id, expires_at")
        .eq("provider_id", userId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString()),
    ]);

    // Attach images to listings
    const imgMap = new Map<string, ListingImage[]>();
    for (const img of (imagesResult.data ?? []) as (ListingImage & { listing_id: string })[]) {
      const arr = imgMap.get(img.listing_id) ?? [];
      arr.push({ id: img.id, url: img.url, sort_order: img.sort_order });
      imgMap.set(img.listing_id, arr);
    }
    const listingsWithImages = ((listingsResult.data ?? []) as Listing[]).map((l) => ({
      ...l,
      images: imgMap.get(l.id) ?? [],
    }));

    setListings(listingsWithImages);
    setCreditBalance(balanceResult.data?.post_credits_balance ?? 0);

    // Build active bumps map
    const bumps: Record<string, { tier: number; expires_at: string }> = {};
    for (const b of (bumpsResult.data ?? []) as { listing_id: string; tier: number; expires_at: string }[]) {
      bumps[b.listing_id] = { tier: b.tier, expires_at: b.expires_at };
    }
    setActiveBumps(bumps);

    // Build active stars map
    const stars: Record<string, { expires_at: string }> = {};
    for (const s of (starsResult.data ?? []) as { listing_id: string; expires_at: string }[]) {
      stars[s.listing_id] = { expires_at: s.expires_at };
    }
    setActiveStars(stars);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace("/auth/signin"); return; }
    fetchListings(user.id);
  }, [user, sessionLoading, router, fetchListings]);

  // Refresh countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setListings((l) => [...l]), 60000);
    return () => clearInterval(interval);
  }, []);

  function openAdd() {
    setEditingId(null); setFormData(EMPTY_FORM); setFormError(null);
    setPendingImages([]); setRemovedImageIds([]);
    setTermsAccepted(false); setTermsPromptOpen(false);
    setDrawerOpen(true);
  }

  function openEdit(listing: Listing) {
    setEditingId(listing.id);
    setFormData({
      title:            listing.title,
      description:      listing.description ?? "",
      duration_minutes: listing.duration_minutes?.toString() ?? "",
      rate_pounds:      String(Math.round(listing.rate / 100)),
      service_type:     listing.service_type ?? "",
      perks_text:       (listing.perks ?? []).join("\n"),
      scheduled_at:      "",
    });
    setPendingImages((listing.images ?? []).map((img) => ({ url: img.url, id: img.id })));
    setRemovedImageIds([]);
    setFormError(null); setTermsAccepted(true); setTermsPromptOpen(false); setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false); setEditingId(null); setFormData(EMPTY_FORM); setFormError(null);
    setPendingImages([]); setRemovedImageIds([]);
    setTermsAccepted(false); setTermsPromptOpen(false);
  }

  function handleSave() {
    if (!user) return;
    const title = formData.title.trim();
    const rate  = parseInt(formData.rate_pounds, 10);
    if (title.length < 2) { setFormError(t("lp_title_min")); return; }
    if (!formData.rate_pounds || isNaN(rate) || rate <= 0) { setFormError(t("lp_rate_invalid")); return; }
    if (!editingId && !termsAccepted) { setTermsPromptOpen(true); return; }

    if (editingId) {
      // Editing — no credit cost, save directly
      doSave();
    } else if (isFirstListing) {
      // First listing is free — save directly, no credit confirm
      doSave();
    } else {
      // Creating additional listing — ask for credit confirmation
      setCreditConfirm({ action: "create" });
    }
  }

  function acceptTermsAndSave() {
    setTermsAccepted(true);
    setTermsPromptOpen(false);
    if (editingId) {
      doSave(true);
    } else if (isFirstListing) {
      doSave(true);
    } else {
      setCreditConfirm({ action: "create" });
    }
  }

  async function doSave(forceTermsAccepted = false) {
    if (!user) return;
    const title = formData.title.trim();
    const rate  = parseInt(formData.rate_pounds, 10);

    setSaving(true); setFormError(null);

    const perks = formData.perks_text
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    const scheduledAt = formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : null;
    const acceptedTerms = forceTermsAccepted || termsAccepted;

    let listingId = editingId;

    if (editingId) {
      const payload: Record<string, unknown> = {
        title,
        description:      formData.description.trim() || null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : null,
        rate:             rate * 100,
        service_type:     formData.service_type || null,
        perks,
        scheduled_at:     scheduledAt,
      };
      if (scheduledAt) payload.is_active = false;
      const { error } = await supabase.from("listings").update(payload).eq("id", editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const res = await apiFetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: formData.description.trim() || null,
          durationMinutes: formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : null,
          rate: rate * 100,
          serviceType: formData.service_type || null,
          perks,
          durationHours: 24,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error ?? "Failed to create listing.");
        setSaving(false);
        return;
      }
      listingId = json.listingId;
      if (listingId && (scheduledAt || termsAccepted)) {
        await supabase
          .from("listings")
          .update({
            scheduled_at: scheduledAt,
            terms_accepted_at: acceptedTerms ? new Date().toISOString() : null,
            ...(scheduledAt ? { is_active: false } : {}),
          })
          .eq("id", listingId)
          .eq("provider_id", user.id);
      }
    }

    // ── Handle images ──
    if (listingId) {
      // Delete removed images
      if (removedImageIds.length > 0) {
        await supabase.from("listing_images").delete().in("id", removedImageIds);
      }

      // Upload new images (ones with a File object)
      const newImages = pendingImages.filter((img) => img.file);
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        if (!img.file) continue;
        try {
          const compressed = await compressImage(img.file, { maxDimension: 1600, quality: 0.82 });
          const ext = compressed.name.split(".").pop() ?? "webp";
          const path = `${user.id}/${listingId}/${Date.now()}_${i}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("listing-images")
            .upload(path, compressed, { upsert: false, contentType: compressed.type });
          if (uploadErr) continue;
          const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
          await supabase.from("listing_images").insert({
            listing_id: listingId,
            provider_id: user.id,
            url: urlData.publicUrl,
            sort_order: pendingImages.indexOf(img),
          });
        } catch { /* skip failed uploads */ }
      }

      // Update sort order for existing images that weren't removed
      const existingImages = pendingImages.filter((img) => img.id && !removedImageIds.includes(img.id));
      for (let i = 0; i < existingImages.length; i++) {
        await supabase.from("listing_images").update({ sort_order: pendingImages.indexOf(existingImages[i]) }).eq("id", existingImages[i].id!);
      }
    }

    await fetchListings(user.id);
    setSaving(false); closeDrawer();
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await supabase.from("listings").delete().eq("id", id);
    setListings((prev) => prev.filter((l) => l.id !== id));
    setDeleteConfirm(null);
  }

  async function handleToggleActive(listing: Listing) {
    await supabase.from("listings").update({ is_active: !listing.is_active }).eq("id", listing.id);
    setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, is_active: !l.is_active } : l));
  }

  function handleRelist(listingId: string) {
    if (!user) return;
    // Launch promo: relisting is free, skip confirmation.
    doRelist(listingId);
  }

  async function doRelist(listingId: string) {
    if (!user) return;
    const res = await apiFetch("/api/listings/relist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFormError(json.error ?? "Failed to relist");
      return;
    }
    await fetchListings(user.id);
  }

  function onCreditConfirm() {
    if (!creditConfirm) return;
    setCreditConfirm(null);
    if (creditConfirm.action === "create") {
      doSave();
    } else if (creditConfirm.action === "relist" && creditConfirm.listingId) {
      doRelist(creditConfirm.listingId);
    }
  }

  async function doBump(listingId: string, tier: number) {
    if (!user) return;
    setBumpingTier(tier);
    const res = await apiFetch("/api/listings/bump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, tier }),
    });
    const json = await res.json();
    setBumpingTier(null);
    if (!res.ok) {
      setFormError(json.error ?? "Failed to bump listing");
      return;
    }
    setBumpDrawer(null);
    await fetchListings(user.id);
  }

  async function openStarDrawer(listingId: string, listingTitle: string) {
    if (!user) return;
    // Fetch provider city + slot availability
    const { data: profile } = await supabase.from("profiles").select("city").eq("id", user.id).single();
    if (!profile?.city) {
      setFormError(t("star_no_city"));
      return;
    }
    const res = await apiFetch(`/api/listings/star?city=${encodeURIComponent(profile.city)}`);
    const json = await res.json();
    setStarSlots(json.slots);
    setStarDrawer({ listingId, listingTitle });
  }

  async function doStar(listingId: string) {
    if (!user) return;
    setStarring(true);
    const res = await apiFetch("/api/listings/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const json = await res.json();
    setStarring(false);
    if (!res.ok) {
      setFormError(json.error ?? "Failed to star listing");
      return;
    }
    setStarDrawer(null);
    await fetchListings(user.id);
  }

  if (sessionLoading || loading) return <PageSkeleton />;

  const activeCount = listings.filter((l) => l.is_active && !isExpired(l.expires_at)).length;
  const scheduledCount = listings.filter((l) => l.scheduled_at && new Date(l.scheduled_at) > new Date()).length;
  const hasCredits = creditBalance > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fafbfc] via-[#fafbfc] to-white pb-24 animate-[fadeIn_0.4s_ease-out]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("lp_title")}</span>
        <button
          onClick={openAdd}
          disabled={!hasCredits && !isFirstListing}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95",
            hasCredits || isFirstListing
              ? "bg-pink-400 text-white shadow-[0_0_15px_rgba(244,114,182,0.3)] hover:bg-pink-300"
              : "bg-gray-100 text-slate-400 cursor-not-allowed"
          )}
        >
          <Plus size={18} />
        </button>
      </header>

      {/* ── Credit balance ── */}
      <div className={cn(
        "mx-4 mt-4 flex items-center justify-between rounded-2xl border px-4 py-3",
        hasCredits
          ? "border-pink-300/20 bg-pink-50"
          : "border-red-500/20 bg-red-500/5"
      )}>
        <div className="flex items-center gap-2.5">
          <Coins size={16} className={hasCredits || isFirstListing ? "text-pink-500" : "text-red-400"} />
          <div>
            <span className="text-[13px] font-medium text-slate-600">
              {creditBalance} {creditBalance !== 1 ? t("credits_credits") : t("credits_credit")}
            </span>
            <p className="text-[11px] text-slate-400">
              {isFirstListing ? t("listings_first_free") : t("listings_credit_per_listing")}
            </p>
          </div>
        </div>
        <Link
          href="/profile/packages"
          className="flex items-center gap-1.5 rounded-full bg-pink-400 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-pink-300 transition"
        >
          <ShoppingBag size={12} />
          {t("lp_buy_credits")}
        </Link>
      </div>

      {/* ── Stats strip ── */}
      {listings.length > 0 && (
        <div className="mx-4 mt-3 flex gap-3">
          {[
            { value: String(listings.length),     label: t("lp_stat_total") },
            { value: String(activeCount),          label: t("lp_stat_live"), highlight: activeCount > 0 },
            { value: String(scheduledCount),       label: "Upcoming", highlight: scheduledCount > 0 },
            { value: avgRate(listings),            label: t("lp_stat_avg_rate") },
          ].map(({ value, label, highlight }) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center rounded-2xl border border-gray-200 bg-white py-3"
            >
              <span className={cn("text-[18px] font-bold tabular-nums", highlight ? "text-emerald-400" : "text-slate-800")}>
                {value}
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-8 pt-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white">
            <ListOrdered size={28} className="text-slate-300" />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-slate-700">{t("listings_no_listings")}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
              {t("listings_first_free_long")}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="mt-2 rounded-full bg-pink-400 px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(244,114,182,0.25)] transition-all hover:bg-pink-300 active:scale-[0.98]"
          >
            {t("lp_create_free")}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 px-4 pt-4">
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onEdit={() => openEdit(listing)}
              onToggle={() => handleToggleActive(listing)}
              onDelete={() => setDeleteConfirm(listing.id)}
              onRelist={() => handleRelist(listing.id)}
              onBump={() => setBumpDrawer({ listingId: listing.id, listingTitle: listing.title })}
              onStar={() => openStarDrawer(listing.id, listing.title)}
              hasCredits={hasCredits}
              activeBump={activeBumps[listing.id] ?? null}
              activeStar={activeStars[listing.id] ?? null}
              deleteConfirmOpen={deleteConfirm === listing.id}
              onDeleteConfirm={() => handleDelete(listing.id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
            />
          ))}

          {(hasCredits || isFirstListing) && (
            <button
              onClick={openAdd}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-4 text-[13px] font-medium text-slate-400 transition-all hover:border-pink-300 hover:text-pink-500"
            >
              <Plus size={15} />
              {t("lp_add_another")} {isFirstListing ? t("lp_add_free") : t("lp_add_credit")}
            </button>
          )}
        </div>
      )}

      {/* ── Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <ListingDrawer
            isEdit={!!editingId}
            isFirstListing={isFirstListing}
            formData={formData}
            onChange={setFormData}
            onSave={handleSave}
            onClose={closeDrawer}
            saving={saving}
            error={formError}
            images={pendingImages}
            termsAccepted={termsAccepted}
            termsPromptOpen={termsPromptOpen}
            onTermsPromptChange={setTermsPromptOpen}
            onTermsAccepted={acceptTermsAndSave}
            onAddImages={(files) => {
              const remaining = 6 - pendingImages.length;
              const toAdd = Array.from(files).slice(0, remaining).map((file) => ({
                file,
                url: URL.createObjectURL(file),
              }));
              setPendingImages((prev) => [...prev, ...toAdd]);
            }}
            onRemoveImage={(index) => {
              const img = pendingImages[index];
              if (img?.id) setRemovedImageIds((prev) => [...prev, img.id!]);
              setPendingImages((prev) => prev.filter((_, i) => i !== index));
            }}
            onReorderImages={(from, to) => {
              setPendingImages((prev) => {
                const arr = [...prev];
                const [item] = arr.splice(from, 1);
                arr.splice(to, 0, item);
                return arr;
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Credit confirmation popup ── */}
      <AnimatePresence>
        {creditConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
              onClick={() => setCreditConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-1/2 z-[61] -translate-y-1/2 rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[340px] sm:-translate-x-1/2"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
                  <Coins size={22} className="text-pink-500" />
                </div>
                <h3 className="text-[16px] font-semibold text-slate-800">
                  {creditConfirm.action === "create" ? t("lp_create_listing") : t("lp_relist_action")}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  {t("lp_credit_use_notice").replace("{amount}", `1 ${t("bump_credit")}`)}
                  {" "}{t("lp_you_have_credits").replace("{count}", `${creditBalance} ${creditBalance !== 1 ? t("bump_credits") : t("bump_credit")}`)}
                </p>
                <div className="mt-5 flex w-full gap-3">
                  <button
                    onClick={() => setCreditConfirm(null)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] font-medium text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
                  >
                    {t("lp_cancel")}
                  </button>
                  <button
                    onClick={onCreditConfirm}
                    className="flex-1 rounded-xl bg-pink-400 py-2.5 text-[13px] font-bold text-white transition hover:bg-pink-300"
                  >
                    {t("lp_spend_credit")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bump tier selection drawer ── */}
      <AnimatePresence>
        {bumpDrawer && (
          <BumpDrawer
            listingTitle={bumpDrawer.listingTitle}
            creditBalance={creditBalance}
            bumpingTier={bumpingTier}
            onSelect={(tier) => doBump(bumpDrawer.listingId, tier)}
            onClose={() => setBumpDrawer(null)}
            error={formError}
          />
        )}
      </AnimatePresence>

      {/* ── Star drawer ── */}
      <AnimatePresence>
        {starDrawer && (
          <StarDrawer
            listingTitle={starDrawer.listingTitle}
            creditBalance={creditBalance}
            starring={starring}
            slots={starSlots}
            onActivate={() => doStar(starDrawer.listingId)}
            onClose={() => setStarDrawer(null)}
            error={formError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Bump Drawer ────────────────────────────────────────────────────────────

type BumpTierDef = {
  tier: number;
  credits: number;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  featureKeys: TranslationKey[];
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
  popular?: boolean;
};

const BUMP_TIERS: BumpTierDef[] = [
  {
    tier: 1, credits: 1,
    labelKey: "bump_basic", descKey: "bump_basic_desc",
    featureKeys: ["bump_feat_stories"],
    icon: Eye, color: "text-sky-400", borderColor: "border-sky-400/30", bgColor: "bg-sky-400/10",
  },
  {
    tier: 2, credits: 2,
    labelKey: "bump_premium", descKey: "bump_premium_desc",
    featureKeys: ["bump_feat_stories", "bump_feat_profiles"],
    icon: Users, color: "text-violet-400", borderColor: "border-violet-400/30", bgColor: "bg-violet-400/10",
    popular: true,
  },
  {
    tier: 3, credits: 3,
    labelKey: "bump_maximum", descKey: "bump_maximum_desc",
    featureKeys: ["bump_feat_stories", "bump_feat_profiles", "bump_feat_feed"],
    icon: Zap, color: "text-pink-500", borderColor: "border-pink-400/30", bgColor: "bg-pink-50",
  },
];

function BumpDrawer({
  listingTitle,
  creditBalance,
  bumpingTier,
  onSelect,
  onClose,
  error,
}: {
  listingTitle: string;
  creditBalance: number;
  bumpingTier: number | null;
  onSelect: (tier: number) => void;
  onClose: () => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-gray-200 bg-white shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-pink-500" />
              <h2 className="text-[15px] font-semibold text-slate-800">{t("bump_title")}</h2>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-400 line-clamp-1">{listingTitle}</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3">
            <p className="text-[12px] font-bold text-slate-800">How bumps work</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              A bump refreshes your listing into higher-visibility areas for a limited window, helping more local clients see it when they are actively browsing.
            </p>
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {t("bump_intro")} <span className="text-slate-800 font-medium">{t("bump_24h")}</span>.
            {" "}{t("bump_you_have")} <span className="font-semibold text-pink-500">{creditBalance} {creditBalance !== 1 ? t("bump_credits") : t("bump_credit")}</span>.
          </p>

          {BUMP_TIERS.map((bt) => {
            const TierIcon = bt.icon;
            const canAfford = creditBalance >= bt.credits;
            const isBumping = bumpingTier === bt.tier;
            return (
              <button
                key={bt.tier}
                onClick={() => canAfford && onSelect(bt.tier)}
                disabled={!canAfford || bumpingTier !== null}
                className={cn(
                  "relative w-full rounded-2xl border p-4 text-left transition-all",
                  canAfford
                    ? `${bt.borderColor} hover:bg-gray-50 active:scale-[0.99]`
                    : "border-gray-200 opacity-40 cursor-not-allowed",
                  bt.popular && canAfford && "ring-1 ring-violet-400/30"
                )}
              >
                {bt.popular && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-violet-500 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    {t("bump_popular")}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bt.bgColor)}>
                    <TierIcon size={18} className={bt.color} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-slate-800">{t(bt.labelKey)}</span>
                      <span className={cn("text-[13px] font-bold", bt.color)}>
                        {bt.credits} {bt.credits !== 1 ? t("bump_credits") : t("bump_credit")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{t(bt.descKey)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bt.featureKeys.map((fk) => (
                        <span key={fk} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-500">
                          <Check size={8} className={bt.color} />
                          {t(fk)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {isBumping && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/95">
                    <Loader2 size={20} className="animate-spin text-pink-500" />
                  </div>
                )}
              </button>
            );
          })}

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
              {error}
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Star Drawer ─────────────────────────────────────────────────────────────

function StarDrawer({
  listingTitle,
  creditBalance,
  starring,
  slots,
  onActivate,
  onClose,
  error,
}: {
  listingTitle: string;
  creditBalance: number;
  starring: boolean;
  slots: { active_count: number; max_slots: number; slots_available: number; next_available: string | null } | null;
  onActivate: () => void;
  onClose: () => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  const canAfford = creditBalance >= 3;
  const slotsFull = slots ? slots.slots_available <= 0 : false;
  const canActivate = canAfford && !slotsFull && !starring;

  function slotCountdown(isoDate: string | null): string {
    if (!isoDate) return "";
    const diff = new Date(isoDate).getTime() - Date.now();
    if (diff <= 0) return "";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-pink-300/20 bg-white shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-pink-300/40" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Star size={16} className="text-pink-500 fill-pink-500" />
              <h2 className="text-[15px] font-semibold text-slate-800">{t("star_title")}</h2>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-400 line-clamp-1">{listingTitle}</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Intro */}
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {t("star_intro")}
          </p>

          {/* Duration + Cost */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-center">
              <Clock size={14} className="mx-auto mb-1 text-pink-500" />
              <p className="text-[14px] font-bold text-slate-800">{t("star_duration_label")}</p>
            </div>
            <div className="flex-1 rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-center">
              <Coins size={14} className="mx-auto mb-1 text-pink-500" />
              <p className="text-[14px] font-bold text-slate-800">{t("star_cost_label")}</p>
            </div>
          </div>

          {/* Slot indicator */}
          {slots && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400">
                  {slots.active_count}/{slots.max_slots} {t("star_slots_info")}
                </span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: slots.max_slots }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 flex-1 rounded-full transition-colors",
                      i < slots.active_count
                        ? "bg-pink-400"
                        : "bg-gray-100"
                    )}
                  />
                ))}
              </div>
              {slotsFull && slots.next_available && (
                <p className="mt-2 text-[11px] text-pink-500">
                  {t("star_next_available")} {slotCountdown(slots.next_available)}
                </p>
              )}
            </div>
          )}

          {/* Credit balance */}
          <p className="text-[12px] text-slate-500">
            {t("bump_you_have")} <span className="font-semibold text-pink-500">{creditBalance} {creditBalance !== 1 ? t("bump_credits") : t("bump_credit")}</span>.
          </p>

          {/* Activate button */}
          <button
            onClick={canActivate ? onActivate : undefined}
            disabled={!canActivate}
            className={cn(
              "w-full rounded-2xl py-3.5 text-[14px] font-bold transition-all",
              canActivate
                ? "bg-[rgb(246,51,154)] text-white hover:brightness-105 active:scale-[0.98] shadow-lg shadow-pink-400/20"
                : "bg-gray-100 text-slate-300 cursor-not-allowed"
            )}
          >
            {starring ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t("star_activating")}
              </span>
            ) : slotsFull ? (
              t("star_slots_full")
            ) : !canAfford ? (
              `${t("star_cost_label")} — ${t("bump_credits")} ${t("lp_status_paused").toLowerCase()}`
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Star size={16} className="fill-white" />
                {t("star_activate")}
              </span>
            )}
          </button>

          {/* Rotation info */}
          <p className="text-center text-[10px] text-slate-300 leading-relaxed">
            {t("star_rotation_info")}
          </p>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
              {error}
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Listing Row ─────────────────────────────────────────────────────────────

function ListingRow({
  listing, onEdit, onToggle, onDelete, onRelist, onBump, onStar, hasCredits,
  activeBump, activeStar, deleteConfirmOpen, onDeleteConfirm, onDeleteCancel,
}: {
  listing: Listing;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onRelist: () => void;
  onBump: () => void;
  onStar: () => void;
  hasCredits: boolean;
  activeBump: { tier: number; expires_at: string } | null;
  activeStar: { expires_at: string } | null;
  deleteConfirmOpen: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const { t } = useTranslation();
  const [relisting, setRelisting] = useState(false);
  const expired = isExpired(listing.expires_at);
  const scheduled = listing.scheduled_at ? new Date(listing.scheduled_at) > new Date() : false;
  const remaining = timeRemaining(listing.expires_at);

  async function handleRelist() {
    setRelisting(true);
    await onRelist();
    setRelisting(false);
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-md transition-all duration-200",
      (expired || !listing.is_active) && "opacity-50"
    )}>
      <div className="px-4 pt-4 pb-3">
        {/* Top row: service type + expiry timer */}
        <div className="flex items-center justify-between mb-2">
          {listing.service_type ? (
            <span className="inline-block rounded-full border border-pink-300/20 bg-pink-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-pink-500">
              {listing.service_type}
            </span>
          ) : <span />}

          <span className={cn(
            "flex items-center gap-1 text-[10px] font-semibold",
            scheduled ? "text-amber-500" : expired ? "text-red-400" : "text-slate-400"
          )}>
            {scheduled ? <CalendarDays size={10} /> : <Timer size={10} />}
            {scheduled ? `Publishes ${new Date(listing.scheduled_at!).toLocaleString()}` : remaining}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-semibold leading-tight text-slate-800">{listing.title}</span>
          <span className="flex-shrink-0 text-[15px] font-bold text-pink-500">{formatRate(listing.rate)}</span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-slate-400">
          <Clock size={10} className="flex-shrink-0" />
          <span className="text-[11px]">{formatDuration(listing.duration_minutes)}</span>
          {listing.perks?.length > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-[11px]">{listing.perks.length} {t("lp_perks")}</span>
            </>
          )}
        </div>

        {listing.description && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-slate-400">
            {listing.description}
          </p>
        )}
      </div>

      {/* Active bump indicator */}
      {activeBump && !expired && (
        <div className="flex items-center justify-between border-t border-pink-200 bg-pink-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <Megaphone size={12} className="text-pink-500" />
            <span className="text-[11px] font-semibold text-pink-500">
              {t("lp_bump_tier")} {activeBump.tier} — {t("lp_bump_active")}
            </span>
            <span className="text-[10px] text-slate-400">
              · {timeRemaining(activeBump.expires_at)}
            </span>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wider text-pink-400/60">
            {activeBump.tier === 1 ? t("lp_bump_stories") : activeBump.tier === 2 ? t("lp_bump_stories_profiles") : t("lp_bump_full")}
          </span>
        </div>
      )}

      {/* Active star indicator */}
      {activeStar && !expired && (
        <div className="flex items-center justify-between border-t border-pink-200 bg-gradient-to-r from-pink-50 to-sky-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <Star size={12} className="text-pink-500 fill-pink-500" />
            <span className="text-[11px] font-semibold text-pink-500">
              {t("star_active")}
            </span>
            <span className="text-[10px] text-slate-400">
              · {timeRemaining(activeStar.expires_at)}
            </span>
          </div>
          <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pink-500">
            {t("star_badge")}
          </span>
        </div>
      )}

      {/* Bump CTA for live listings without active bump */}
      {!expired && listing.is_active && !activeBump && (
        <button
          onClick={onBump}
          className="flex w-full items-center justify-center gap-2 border-t border-gray-200 py-2.5 text-[11px] font-semibold text-pink-500 transition-colors hover:bg-pink-50"
        >
          <Megaphone size={12} />
          {t("lp_promote")}
        </button>
      )}

      {/* Star CTA for live listings without active star */}
      {!expired && listing.is_active && !activeStar && (
        <button
          onClick={onStar}
          className="flex w-full items-center justify-center gap-2 border-t border-gray-200 py-2.5 text-[11px] font-semibold text-pink-500 transition-colors hover:bg-pink-50"
        >
          <Star size={12} className="fill-pink-500" />
          {t("star_promote")}
        </button>
      )}

      {/* Relist banner for expired listings */}
      {expired && (
        <div className="flex items-center justify-between border-t border-pink-200 bg-pink-50 px-4 py-2.5">
          <p className="text-[12px] text-pink-500">{t("lp_expired_relist")}</p>
          <button
            onClick={handleRelist}
            disabled={!hasCredits || relisting}
            className="flex items-center gap-1.5 rounded-full bg-pink-400 px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-pink-300 disabled:opacity-50"
          >
            {relisting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {relisting ? t("lp_relisting") : t("lp_relist")}
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center border-t border-gray-200">
        <button
          onClick={onToggle}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
            listing.is_active && !expired ? "text-emerald-400 hover:bg-emerald-400/5" : "text-slate-300 hover:bg-gray-50"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", listing.is_active && !expired ? "bg-emerald-400" : "bg-slate-300")} />
          {expired ? t("lp_status_expired") : listing.is_active ? t("lp_status_live") : t("lp_status_paused")}
        </button>

        <div className="h-6 w-px bg-gray-200" />

        <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:bg-gray-50 hover:text-slate-600">
          <Pencil size={11} /> {t("lp_edit")}
        </button>

        <div className="h-6 w-px bg-gray-200" />

        <Link href={`/listings/${listing.id}`} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:bg-gray-50 hover:text-slate-600">
          <ExternalLink size={11} /> {t("lp_view")}
        </Link>

        <div className="h-6 w-px bg-gray-200" />

        <button onClick={onDelete} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400">
          <Trash2 size={11} /> {t("lp_delete")}
        </button>
      </div>

      <AnimatePresence>
        {deleteConfirmOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-red-500/20 bg-red-500/5"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[12px] text-red-400">{t("lp_delete_confirm")}</p>
              <div className="flex gap-4">
                <button onClick={onDeleteCancel} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700">
                  <X size={12} /> {t("lp_cancel")}
                </button>
                <button onClick={onDeleteConfirm} className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300">
                  <Trash2 size={12} /> {t("lp_delete")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Form Drawer ─────────────────────────────────────────────────────────────

function ListingDrawer({
  isEdit, isFirstListing, formData, onChange, onSave, onClose, saving, error,
  images, termsAccepted, termsPromptOpen, onTermsPromptChange, onTermsAccepted,
  onAddImages, onRemoveImage, onReorderImages,
}: {
  isEdit: boolean;
  isFirstListing: boolean;
  formData: FormData;
  onChange: (d: FormData) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  images: { file?: File; url: string; id?: string }[];
  termsAccepted: boolean;
  termsPromptOpen: boolean;
  onTermsPromptChange: (open: boolean) => void;
  onTermsAccepted: () => void;
  onAddImages: (files: FileList) => void;
  onRemoveImage: (index: number) => void;
  onReorderImages: (from: number, to: number) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  function patch(key: keyof FormData, value: string) {
    onChange({ ...formData, [key]: value });
  }

  function nextStep() {
    setStep((s) => Math.min(totalSteps, s + 1));
  }

  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-gray-200 bg-white shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">{isEdit ? t("lf_edit") : t("lf_new")}</h2>
            {!isEdit && (
              <p className="text-[11px] text-slate-400">
                Step {step} of {totalSteps} - {isFirstListing ? t("lf_free_subtitle") : t("lf_credit_subtitle")}
              </p>
            )}
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-gray-200 px-5 py-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-pink-400 transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {["Photos", "Basics", "Details", "Schedule", "Review"].map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index + 1)}
                className={cn("rounded-full px-2 py-1 text-[9px] font-semibold", step === index + 1 ? "bg-pink-50 text-pink-500" : "text-slate-300")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-4">

          {step === 1 && (
          <>
          <ProTip title="Photo tip">Lead with a clear, recent cover image. Add variety so clients can understand your style before messaging.</ProTip>
          <Field label={`${t("lf_photos")} (${images.length}/6)`}>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {images.map((img, i) => (
                <div key={img.url} className="relative flex-shrink-0 group">
                  <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-gray-200">
                    <Image src={img.url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="96px" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded-full bg-pink-400 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        {t("lf_cover")}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveImage(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                  {i > 0 && (
                    <button
                      onClick={() => onReorderImages(i, i - 1)}
                      className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-slate-600 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Move left"
                    >
                      <GripVertical size={9} />
                    </button>
                  )}
                </div>
              ))}
              {images.length < 6 && (
                <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-slate-400 transition hover:border-pink-300 hover:text-pink-500">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.length) onAddImages(e.target.files); e.target.value = ""; }}
                  />
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus size={18} />
                    <span className="text-[9px] font-medium">{t("lf_add")}</span>
                  </div>
                </label>
              )}
            </div>
            <p className="mt-1 text-[10px] text-slate-300">{t("lf_photo_hint")}</p>
          </Field>
          </>
          )}

          {step === 2 && (
          <>
          <ProTip title="Listing tip">Use a specific title and service type. Clear listings feel safer and get better qualified messages.</ProTip>
          <Field label={`${t("lf_title")} *`}>
            <input
              type="text" placeholder="e.g. GFE – The Full Experience"
              value={formData.title} onChange={(e) => patch("title", e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-slate-700 placeholder-slate-300 outline-none transition focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
            />
            <p className="mt-1 text-right text-[10px] text-slate-300">{formData.title.length}/80</p>
          </Field>

          <Field label={t("lf_service_type")}>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPE_KEYS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => patch("service_type", formData.service_type === value ? "" : value)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                    formData.service_type === value
                      ? "border-pink-300 bg-pink-50 text-pink-500"
                      : "border-gray-200 bg-gray-50 text-slate-500 hover:border-gray-300 hover:text-slate-700"
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </Field>
          </>
          )}

          {step === 3 && (
          <>
          <ProTip title="Description tip">Mention boundaries, availability, and what makes the experience distinct. Avoid prohibited or illegal content.</ProTip>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("lf_rate")} *`}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-500">CA$</span>
                <input
                  type="number" inputMode="numeric" placeholder="200"
                  value={formData.rate_pounds} onChange={(e) => patch("rate_pounds", e.target.value)}
                  min={1}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-8 pr-4 text-[14px] text-slate-700 placeholder-slate-300 outline-none transition focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
                />
              </div>
            </Field>
            <Field label={t("lf_duration")}>
              <select
                value={formData.duration_minutes}
                onChange={(e) => patch("duration_minutes", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-[14px] text-slate-700 outline-none transition focus:border-pink-300"
              >
                {DURATION_PRESET_KEYS.map((p) => (
                  <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("lf_description")}>
            <textarea
              placeholder={t("lf_desc_ph")}
              value={formData.description} onChange={(e) => patch("description", e.target.value)}
              maxLength={500} rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-slate-700 placeholder-slate-300 outline-none transition focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
            />
            <p className="mt-1 text-right text-[10px] text-slate-300">{formData.description.length}/500</p>
          </Field>

          <Field label={t("lf_included")}>
            <textarea
              placeholder={t("lf_included_ph")}
              value={formData.perks_text} onChange={(e) => patch("perks_text", e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-[13px] text-slate-700 placeholder-slate-300 outline-none transition focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
            />
            <p className="mt-1 text-[10px] text-slate-300">
              {formData.perks_text.split("\n").filter((l) => l.trim()).length} {t("lf_perks_count")}
            </p>
          </Field>
          </>
          )}

          {step === 4 && (
          <>
            <ProTip title="Posting strategy">Publishing during your busiest local browsing hours can improve visibility. Scheduling keeps the listing ready without rushing.</ProTip>
            <Field label="Schedule publication">
              <div className="relative">
                <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => patch("scheduled_at", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-4 text-[14px] text-slate-700 outline-none transition focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-300">Leave blank to publish immediately. Times use your device timezone.</p>
            </Field>
          </>
          )}

          {step === 5 && (
          <>
            <ProTip title="Safety review">Before publishing, confirm the listing follows platform rules and does not include illegal or prohibited content.</ProTip>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[14px] font-semibold text-slate-800">{formData.title || "Untitled listing"}</p>
              <p className="mt-1 text-[12px] text-slate-500">{formData.service_type || "No service type"} · CA${formData.rate_pounds || "0"}</p>
              {formData.scheduled_at && <p className="mt-2 text-[12px] text-amber-500">Scheduled for {new Date(formData.scheduled_at).toLocaleString()}</p>}
              <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-500">
                <ShieldCheck size={14} className={termsAccepted ? "text-emerald-400" : "text-slate-300"} />
                {termsAccepted ? "Terms accepted" : "Terms acceptance required before publishing"}
              </div>
            </div>
          </>
          )}

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Save */}
        <div className="flex gap-3 border-t border-gray-200 px-5 pb-4 pt-3">
          <button
            onClick={prevStep}
            disabled={step === 1 || saving}
            className="rounded-2xl border border-gray-200 px-5 py-3.5 text-[13px] font-semibold text-slate-500 transition hover:bg-gray-50 disabled:opacity-40"
          >
            Back
          </button>
          {step < totalSteps ? (
            <button
              onClick={nextStep}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pink-400 py-3.5 text-[14px] font-bold text-white shadow-[0_0_20px_rgba(244,114,182,0.2)] transition-all hover:bg-pink-300 active:scale-[0.99]"
            >
              Continue <ArrowLeft size={16} className="rotate-180" />
            </button>
          ) : (
            <button
              onClick={onSave} disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pink-400 py-3.5 text-[14px] font-bold text-white shadow-[0_0_20px_rgba(244,114,182,0.2)] transition-all hover:bg-pink-300 active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? (
                <span className="animate-pulse">{t("lf_saving")}</span>
              ) : isEdit ? (
                <><Check size={16} /> {t("lf_save_changes")}</>
              ) : isFirstListing ? (
                <><Plus size={16} /> {t("lf_create_free")}</>
              ) : (
                <><Plus size={16} /> {t("lf_create_credit")}</>
              )}
            </button>
          )}
        </div>
      </motion.div>

      <TermsModal
        open={termsPromptOpen}
        onClose={() => onTermsPromptChange(false)}
        onAccept={onTermsAccepted}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function ProTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-sky-500" />
        <div>
          <p className="text-[12px] font-bold text-slate-700">{title}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{children}</p>
        </div>
      </div>
    </div>
  );
}

function TermsModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  if (!open) return null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-x-4 top-1/2 z-[71] max-h-[82vh] -translate-y-1/2 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2"
      >
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-[16px] font-bold text-slate-800">Adult listing terms</h3>
          <p className="mt-1 text-[12px] text-slate-400">Vous acceptez ce qui suit lorsque vous publiez une annonce dans la section adulte.</p>
        </div>
        <div className="max-h-[42vh] space-y-3 overflow-y-auto px-5 py-4 text-[13px] leading-6 text-slate-600">
          <p>You confirm that your listing follows all platform rules and applicable laws.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>I will not post illegal images, illegal content, trafficking, coercion, or underage content.</li>
            <li>No prohibited services, explicit illegal offers, impersonation, or misleading claims.</li>
            <li>Only upload content you own or have permission to use.</li>
            <li>Keep communication respectful, consensual, and within platform safety rules.</li>
          </ul>
        </div>
        <div className="border-t border-gray-200 px-5 py-4">
          <label className="flex items-start gap-3 text-[12px] text-slate-600">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-pink-500" />
            I confirm this listing complies with platform rules and does not contain illegal or prohibited content.
          </label>
          <div className="mt-4 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] font-semibold text-slate-500">Cancel</button>
            <button onClick={onAccept} disabled={!checked} className="flex-1 rounded-xl bg-pink-400 py-2.5 text-[13px] font-bold text-white disabled:opacity-40">I Accept</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-[#fafbfc]">
      <div className="h-[53px] border-b border-gray-200 bg-white" />
      <div className="mx-4 mt-4 flex gap-3">
        {[1,2,3].map((i) => <div key={i} className="h-16 flex-1 rounded-2xl bg-gray-100" />)}
      </div>
      <div className="mt-4 space-y-3 px-4">
        {[1,2,3].map((i) => <div key={i} className="h-28 rounded-2xl bg-gray-100" />)}
      </div>
    </div>
  );
}
