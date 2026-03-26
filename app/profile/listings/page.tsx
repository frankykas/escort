"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Pencil, Trash2, Clock, X, Check,
  ListOrdered, ExternalLink, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

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
};

type FormData = {
  title: string;
  description: string;
  duration_minutes: string;
  rate_pounds: string;
  service_type: string;
  perks_text: string; // one perk per line
};

const EMPTY_FORM: FormData = {
  title: "", description: "", duration_minutes: "",
  rate_pounds: "", service_type: "", perks_text: "",
};

const SERVICE_TYPES = [
  "Companionship", "Dinner Date", "Travel",
  "GFE", "Couples", "Massage", "Domination",
];

const DURATION_PRESETS = [
  { label: "On request", value: "" },
  { label: "30 min",     value: "30" },
  { label: "1 hr",       value: "60" },
  { label: "90 min",     value: "90" },
  { label: "2 hr",       value: "120" },
  { label: "4 hr",       value: "240" },
  { label: "Overnight",  value: "720" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRate(pence: number): string {
  return `CA$${Math.round(pence / 100).toLocaleString()}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "On request";
  if (minutes === 720) return "Overnight";
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [listings, setListings]         = useState<Listing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [formData, setFormData]         = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError]       = useState<string | null>(null);

  const fetchListings = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("listings")
      .select("id, title, description, duration_minutes, rate, is_active, sort_order, service_type, perks")
      .eq("provider_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setListings((data as Listing[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace("/auth/signin"); return; }
    fetchListings(user.id);
  }, [user, sessionLoading, router, fetchListings]);

  function openAdd() {
    setEditingId(null); setFormData(EMPTY_FORM); setFormError(null); setDrawerOpen(true);
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
    });
    setFormError(null); setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false); setEditingId(null); setFormData(EMPTY_FORM); setFormError(null);
  }

  async function handleSave() {
    if (!user) return;
    const title = formData.title.trim();
    const rate  = parseInt(formData.rate_pounds, 10);
    if (title.length < 2) { setFormError("Title must be at least 2 characters."); return; }
    if (!formData.rate_pounds || isNaN(rate) || rate <= 0) { setFormError("Please enter a valid rate."); return; }

    setSaving(true); setFormError(null);

    const perks = formData.perks_text
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      title,
      description:      formData.description.trim() || null,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : null,
      rate:             rate * 100,
      service_type:     formData.service_type || null,
      perks,
    };

    if (editingId) {
      const { error } = await supabase.from("listings").update(payload).eq("id", editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("listings").insert({ ...payload, provider_id: user.id });
      if (error) { setFormError(error.message); setSaving(false); return; }
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

  if (sessionLoading || loading) return <PageSkeleton />;

  const activeCount = listings.filter((l) => l.is_active).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black pb-24 animate-[fadeIn_0.4s_ease-out]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-zinc-950/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-[15px] font-semibold text-white">My Listings</span>
        <button
          onClick={openAdd}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all hover:bg-amber-300 active:scale-95"
        >
          <Plus size={18} />
        </button>
      </header>

      {/* ── Stats strip ── */}
      {listings.length > 0 && (
        <div className="mx-4 mt-4 flex gap-3">
          {[
            { value: String(listings.length),     label: "Total" },
            { value: String(activeCount),          label: "Active", highlight: activeCount > 0 },
            { value: avgRate(listings),            label: "Avg rate" },
          ].map(({ value, label, highlight }) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center rounded-2xl border border-white/5 bg-zinc-900/70 py-3"
            >
              <span className={cn("text-[18px] font-bold tabular-nums", highlight ? "text-emerald-400" : "text-white")}>
                {value}
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-8 pt-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-zinc-900">
            <ListOrdered size={28} className="text-zinc-600" />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-zinc-200">No listings yet</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
              Add your first service listing so clients can see what you offer.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="mt-2 rounded-full bg-amber-400 px-6 py-2.5 text-[13px] font-semibold text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.25)] transition-all hover:bg-amber-300 active:scale-[0.98]"
          >
            Add your first listing
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
              deleteConfirmOpen={deleteConfirm === listing.id}
              onDeleteConfirm={() => handleDelete(listing.id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
            />
          ))}

          <button
            onClick={openAdd}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-4 text-[13px] font-medium text-zinc-500 transition-all hover:border-amber-400/30 hover:text-amber-400"
          >
            <Plus size={15} />
            Add another listing
          </button>
        </div>
      )}

      {/* ── Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <ListingDrawer
            isEdit={!!editingId}
            formData={formData}
            onChange={setFormData}
            onSave={handleSave}
            onClose={closeDrawer}
            saving={saving}
            error={formError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Listing Row ─────────────────────────────────────────────────────────────

function ListingRow({
  listing, onEdit, onToggle, onDelete,
  deleteConfirmOpen, onDeleteConfirm, onDeleteCancel,
}: {
  listing: Listing;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-md transition-all duration-200",
      !listing.is_active && "opacity-50"
    )}>
      <div className="px-4 pt-4 pb-3">
        {/* Service type chip */}
        {listing.service_type && (
          <span className="mb-2 inline-block rounded-full border border-amber-400/20 bg-amber-400/8 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
            {listing.service_type}
          </span>
        )}

        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-semibold leading-tight text-white">{listing.title}</span>
          <span className="flex-shrink-0 text-[15px] font-bold text-amber-400">{formatRate(listing.rate)}</span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-zinc-500">
          <Clock size={10} className="flex-shrink-0" />
          <span className="text-[11px]">{formatDuration(listing.duration_minutes)}</span>
          {listing.perks?.length > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-[11px]">{listing.perks.length} perks</span>
            </>
          )}
        </div>

        {listing.description && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
            {listing.description}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center border-t border-white/5">
        <button
          onClick={onToggle}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
            listing.is_active ? "text-emerald-400 hover:bg-emerald-400/5" : "text-zinc-600 hover:bg-white/5"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", listing.is_active ? "bg-emerald-400" : "bg-zinc-700")} />
          {listing.is_active ? "Active" : "Inactive"}
        </button>

        <div className="h-6 w-px bg-white/5" />

        <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300">
          <Pencil size={11} /> Edit
        </button>

        <div className="h-6 w-px bg-white/5" />

        <Link href={`/listings/${listing.id}`} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300">
          <ExternalLink size={11} /> View
        </Link>

        <div className="h-6 w-px bg-white/5" />

        <button onClick={onDelete} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400">
          <Trash2 size={11} /> Delete
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
              <p className="text-[12px] text-red-400">Delete this listing?</p>
              <div className="flex gap-4">
                <button onClick={onDeleteCancel} className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200">
                  <X size={12} /> Cancel
                </button>
                <button onClick={onDeleteConfirm} className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300">
                  <Trash2 size={12} /> Delete
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
  isEdit, formData, onChange, onSave, onClose, saving, error,
}: {
  isEdit: boolean;
  formData: FormData;
  onChange: (d: FormData) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  function patch(key: keyof FormData, value: string) {
    onChange({ ...formData, [key]: value });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-950 shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h2 className="text-[15px] font-semibold text-white">{isEdit ? "Edit Listing" : "New Listing"}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-4">

          {/* Title */}
          <Field label="Title *">
            <input
              type="text" placeholder="e.g. GFE – The Full Experience"
              value={formData.title} onChange={(e) => patch("title", e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-white/8 bg-zinc-900 px-4 py-3 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20"
            />
            <p className="mt-1 text-right text-[10px] text-zinc-600">{formData.title.length}/80</p>
          </Field>

          {/* Service type */}
          <Field label="Service type">
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => patch("service_type", formData.service_type === type ? "" : type)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                    formData.service_type === type
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                      : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </Field>

          {/* Rate + Duration inline */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate (CA$) *">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-zinc-400">CA$</span>
                <input
                  type="number" inputMode="numeric" placeholder="200"
                  value={formData.rate_pounds} onChange={(e) => patch("rate_pounds", e.target.value)}
                  min={1}
                  className="w-full rounded-xl border border-white/8 bg-zinc-900 py-3 pl-8 pr-4 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20"
                />
              </div>
            </Field>
            <Field label="Duration">
              <select
                value={formData.duration_minutes}
                onChange={(e) => patch("duration_minutes", e.target.value)}
                className="w-full rounded-xl border border-white/8 bg-zinc-900 px-3 py-3 text-[14px] text-zinc-100 outline-none transition focus:border-amber-400/40"
              >
                {DURATION_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Description */}
          <Field label="Description">
            <textarea
              placeholder="Describe what this service includes…"
              value={formData.description} onChange={(e) => patch("description", e.target.value)}
              maxLength={500} rows={3}
              className="w-full resize-none rounded-xl border border-white/8 bg-zinc-900 px-4 py-3 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20"
            />
            <p className="mt-1 text-right text-[10px] text-zinc-600">{formData.description.length}/500</p>
          </Field>

          {/* Perks */}
          <Field label="What's included (one per line)">
            <textarea
              placeholder={"Incall or outcall\nStrictly discreet\nDinner or drinks"}
              value={formData.perks_text} onChange={(e) => patch("perks_text", e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/8 bg-zinc-900 px-4 py-3 font-mono text-[13px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20"
            />
            <p className="mt-1 text-[10px] text-zinc-600">
              {formData.perks_text.split("\n").filter((l) => l.trim()).length} perks added
            </p>
          </Field>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Save */}
        <div className="border-t border-white/5 px-5 pb-4 pt-3">
          <button
            onClick={onSave} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? <span className="animate-pulse">Saving…</span> : <><Check size={16} /> {isEdit ? "Save changes" : "Add listing"}</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-zinc-950">
      <div className="h-[53px] border-b border-zinc-900 bg-zinc-950" />
      <div className="mx-4 mt-4 flex gap-3">
        {[1,2,3].map((i) => <div key={i} className="h-16 flex-1 rounded-2xl bg-zinc-900" />)}
      </div>
      <div className="mt-4 space-y-3 px-4">
        {[1,2,3].map((i) => <div key={i} className="h-28 rounded-2xl bg-zinc-900" />)}
      </div>
    </div>
  );
}
