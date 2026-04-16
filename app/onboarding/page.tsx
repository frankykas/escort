"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Camera, Loader2, User, Sparkles,
  MapPin, CheckCircle, Search, Crown, DollarSign,
  PlusCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ─── Constants ──────────────────────────────────────────────────────────────

const SERVICE_CATS = ["Escorts", "GFE", "Companionship", "Dinner Date", "Travel", "Massage", "Domination", "Couples"];
const COUNTRY_OPTIONS = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "FR", name: "France" },
];

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = "client" | "provider" | null;
type Step = "role" | "profile" | "rate" | "listing" | "done";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20";

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, checked } = useSession();
  const { refetch } = useProfile();

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>(null);

  // Profile fields
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("CA");
  const [categories, setCategories] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Rate field
  const [hourlyRate, setHourlyRate] = useState("");

  // First listing fields
  const [listingTitle, setListingTitle] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingDuration, setListingDuration] = useState("60");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [checked, user, router]);

  function selectRole(r: Role) {
    setRole(r);
    setStep("profile");
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setAvatarPreview(URL.createObjectURL(file));

    const compressed = await compressImage(file, { maxDimension: 800, quality: 0.85 });
    const ext = compressed.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, compressed, { upsert: true, contentType: compressed.type });

    if (upErr) {
      setError(t("onb_err_photo"));
      setAvatarPreview(null);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(publicUrl);
    setUploading(false);
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleFinish() {
    if (!user) return;
    if (!username.trim()) { setError(t("onb_err_username")); return; }

    setSaving(true);
    setError(null);

    const payload: Record<string, any> = {
      username: username.trim().toLowerCase().replace(/\s+/g, "."),
      is_provider: role === "provider",
      onboarding_completed: true,
    };

    if (role === "provider") {
      if (bio.trim()) payload.bio = bio.trim();
      if (city.trim()) payload.city = city.trim();
      payload.country_code = countryCode;
      if (categories.length > 0) payload.service_categories = categories;
      if (hourlyRate) payload.hourly_rate = Math.round(parseFloat(hourlyRate) * 100);
    }

    if (avatarUrl) payload.avatar_url = avatarUrl;

    // Update profile
    const { error: saveErr } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (saveErr) {
      setSaving(false);
      if (saveErr.message.includes("profiles_username_key")) {
        setError(t("onb_err_username_taken"));
      } else {
        setError(saveErr.message);
      }
      return;
    }

    // Create first listing if provided
    if (role === "provider" && listingTitle.trim() && listingPrice) {
      await supabase.from("listings").insert({
        provider_id: user.id,
        title: listingTitle.trim(),
        rate: Math.round(parseFloat(listingPrice) * 100),
        duration_minutes: parseInt(listingDuration),
        service_type: categories[0] ?? "Escorts",
        is_active: true,
      });
    }

    setSaving(false);
    refetch();
    setStep("done");
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <p className="mb-8 text-center text-2xl font-bold tracking-tight text-amber-400">
          Cleopatra
        </p>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Role selection ── */}
          {step === "role" && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h1 className="text-[20px] font-bold text-white">{t("onb_welcome")}</h1>
                <p className="mt-1.5 text-[14px] text-zinc-400">{t("onb_how_use")}</p>
              </div>

              <button
                onClick={() => selectRole("client")}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-5 text-left transition-all hover:border-amber-400/30 hover:bg-zinc-900 active:scale-[0.99]"
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-500/10">
                  <Search size={24} className="text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[16px] font-semibold text-white">{t("onb_browsing")}</p>
                  <p className="mt-0.5 text-[13px] text-zinc-500">
                    {t("onb_browsing_desc")}
                  </p>
                </div>
                <ArrowRight size={18} className="flex-shrink-0 text-zinc-600" />
              </button>

              <button
                onClick={() => selectRole("provider")}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-5 text-left transition-all hover:border-amber-400/30 hover:bg-zinc-900 active:scale-[0.99]"
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-400/10">
                  <Crown size={24} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[16px] font-semibold text-white">{t("onb_provider")}</p>
                  <p className="mt-0.5 text-[13px] text-zinc-500">
                    {t("onb_provider_desc")}
                  </p>
                </div>
                <ArrowRight size={18} className="flex-shrink-0 text-zinc-600" />
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Profile setup ── */}
          {step === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 backdrop-blur-xl"
            >
              <h1 className="text-[18px] font-bold text-white">
                {role === "provider" ? t("onb_setup_profile") : t("onb_choose_username")}
              </h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {role === "provider" ? t("onb_provider_intro") : t("onb_client_intro")}
              </p>

              <div className="mt-6 space-y-5">

                {/* Avatar */}
                <div className="flex justify-center">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="group relative"
                  >
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/15 bg-zinc-800 transition group-hover:border-amber-400/40">
                      {avatarPreview ? (
                        <Image
                          src={avatarPreview}
                          alt="Avatar"
                          width={96} height={96}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User size={32} className="text-zinc-600" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-lg">
                      {uploading
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Camera size={14} />
                      }
                    </div>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    {t("onb_username_label")}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("onb_username_ph")}
                    maxLength={30}
                    className={inputCls}
                  />
                </div>

                {/* Provider-only fields */}
                {role === "provider" && (
                  <>
                    {/* Bio */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                        {t("onb_bio")}
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder={t("onb_bio_ph")}
                        maxLength={160}
                        rows={2}
                        className={cn(inputCls, "resize-none")}
                      />
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                          {t("onb_city")}
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder={t("onb_city_ph")}
                          maxLength={40}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                          {t("onb_country")}
                        </label>
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className={inputCls}
                        >
                          {COUNTRY_OPTIONS.map((c) => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Categories */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                        {t("onb_services")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_CATS.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
                              categories.includes(cat)
                                ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                                : "border-white/10 bg-zinc-800 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {error && <p className="text-[12px] text-red-400">{error}</p>}

                <button
                  onClick={() => role === "provider" ? setStep("rate") : handleFinish()}
                  disabled={saving || !username.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.99] disabled:opacity-40"
                >
                  {saving ? (
                    <><Loader2 size={14} className="animate-spin" /> {t("onb_saving")}</>
                  ) : (
                    <>{role === "provider" ? t("onb_next") : t("onb_get_started")} <ArrowRight size={15} /></>
                  )}
                </button>

                <button
                  onClick={() => { setStep("role"); setRole(null); }}
                  className="w-full text-center text-[12px] text-zinc-600 hover:text-zinc-400 transition"
                >
                  {t("onb_go_back")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2.1: Rate setup ── */}
          {step === "rate" && (
            <motion.div
              key="rate"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 backdrop-blur-xl"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10">
                <DollarSign size={24} className="text-amber-400" />
              </div>
              <h1 className="text-[18px] font-bold text-white">{t("onb_rate_title")}</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {t("onb_rate_desc")}
              </p>

              <div className="mt-6 space-y-5">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-zinc-500">CA$</span>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="250"
                    className={cn(inputCls, "pl-12")}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-zinc-600">{t("onb_rate_per_hour")}</span>
                </div>

                <button
                  onClick={() => setStep("listing")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.99]"
                >
                  {t("onb_next")} <ArrowRight size={15} />
                </button>

                <button
                  onClick={() => setStep("profile")}
                  className="w-full text-center text-[12px] text-zinc-600 hover:text-zinc-400 transition"
                >
                  {t("onb_go_back")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2.2: First Listing ── */}
          {step === "listing" && (
            <motion.div
              key="listing"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 backdrop-blur-xl"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
                <PlusCircle size={24} className="text-sky-400" />
              </div>
              <h1 className="text-[18px] font-bold text-white">{t("onb_listing_title")}</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {t("onb_listing_desc")}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    {t("onb_listing_title_label")}
                  </label>
                  <input
                    type="text"
                    value={listingTitle}
                    onChange={(e) => setListingTitle(e.target.value)}
                    placeholder={t("onb_listing_title_ph")}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                      {t("onb_duration_min")}
                    </label>
                    <select
                      value={listingDuration}
                      onChange={(e) => setListingDuration(e.target.value)}
                      className={inputCls}
                    >
                      <option value="30">{t("onb_min_30")}</option>
                      <option value="60">{t("onb_min_60")}</option>
                      <option value="90">{t("onb_min_90")}</option>
                      <option value="120">{t("onb_hours_2")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                      {t("onb_price_cad")}
                    </label>
                    <input
                      type="number"
                      value={listingPrice}
                      onChange={(e) => setListingPrice(e.target.value)}
                      placeholder={hourlyRate || "250"}
                      className={inputCls}
                    />
                  </div>
                </div>

                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.99] disabled:opacity-40"
                >
                  {saving ? (
                    <><Loader2 size={14} className="animate-spin" /> {t("onb_launching")}</>
                  ) : (
                    <><Sparkles size={15} /> {t("onb_launch_profile")}</>
                  )}
                </button>

                <button
                  onClick={() => handleFinish()}
                  disabled={saving}
                  className="w-full text-center text-[12px] text-zinc-600 hover:text-zinc-400 transition"
                >
                  {t("onb_skip")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 text-center backdrop-blur-xl"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10">
                <CheckCircle size={32} className="text-amber-400" />
              </div>
              <h1 className="mt-4 text-[20px] font-bold text-white">
                {role === "provider" ? t("onb_live") : t("onb_welcome_aboard")}
              </h1>
              <p className="mt-2 text-[14px] text-zinc-400">
                {role === "provider" ? t("onb_live_body") : t("onb_client_body")}
              </p>
              <button
                onClick={() => {
                  const next = localStorage.getItem("signup_next");
                  if (next) localStorage.removeItem("signup_next");
                  router.push(next && next.startsWith("/") ? next : "/");
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 transition hover:bg-amber-300"
              >
                <ArrowRight size={16} />
                {role === "provider" ? t("onb_go_dashboard") : t("onb_start_exploring")}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
