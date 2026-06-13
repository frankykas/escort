"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Camera, Check, Loader2,
  User, MapPin, Sparkles, Ruler, Globe,
  DollarSign, Phone, Shield, ChevronDown,
  Heart, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/upload-avatar";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

// ─── Constants ───────────────────────────────────────────────────────────────

const BUILD_OPTIONS    = ["Slim", "Petite", "Athletic", "Average", "Curvy", "Plus-size"];
const HAIR_OPTIONS     = ["Blonde", "Brunette", "Black", "Red", "Auburn", "Silver", "Other"];
const EYE_OPTIONS      = ["Brown", "Blue", "Green", "Hazel", "Grey", "Amber", "Other"];
const SERVICE_CATS     = ["Companionship", "Dinner Date", "Travel", "GFE", "Couples", "Massage", "Domination"];
const LANGUAGES        = ["English", "French", "Spanish", "Portuguese", "Italian", "Russian", "Arabic", "Mandarin", "Japanese", "German", "Hindi", "Korean"];
const GENDER_OPTIONS   = ["Woman", "Man", "Trans Woman", "Trans Man", "Non-binary", "Other"];
const PRONOUN_OPTIONS  = ["She/Her", "He/Him", "They/Them"];
const CATERS_TO_OPTIONS = ["Men", "Women", "Couples", "Non-binary", "Everyone"];

// Map English option values → translation keys (values stored as English in DB)
const OPTION_LABEL_KEYS: Record<string, TranslationKey> = {
  // Build
  "Slim": "opt_build_slim", "Petite": "opt_build_petite", "Athletic": "opt_build_athletic",
  "Average": "opt_build_average", "Curvy": "opt_build_curvy", "Plus-size": "opt_build_plus_size",
  // Hair
  "Blonde": "opt_hair_blonde", "Brunette": "opt_hair_brunette", "Black": "opt_hair_black",
  "Red": "opt_hair_red", "Auburn": "opt_hair_auburn", "Silver": "opt_hair_silver",
  // Eye
  "Brown": "opt_eye_brown", "Blue": "opt_eye_blue", "Green": "opt_eye_green",
  "Hazel": "opt_eye_hazel", "Grey": "opt_eye_grey", "Amber": "opt_eye_amber",
  // Other (shared by hair + eye + gender)
  "Other": "opt_eye_other",
  // Services
  "Companionship": "opt_service_companionship", "Dinner Date": "opt_service_dinner_date",
  "Travel": "opt_service_travel", "GFE": "opt_service_gfe", "Massage": "opt_service_massage",
  "Domination": "opt_service_domination",
  // Languages
  "English": "opt_lang_english", "French": "opt_lang_french", "Spanish": "opt_lang_spanish",
  "Portuguese": "opt_lang_portuguese", "Italian": "opt_lang_italian", "Russian": "opt_lang_russian",
  "Arabic": "opt_lang_arabic", "Mandarin": "opt_lang_mandarin", "Japanese": "opt_lang_japanese",
  "German": "opt_lang_german", "Hindi": "opt_lang_hindi", "Korean": "opt_lang_korean",
  // Gender
  "Woman": "opt_gender_woman", "Man": "opt_gender_man", "Trans Woman": "opt_gender_trans_woman",
  "Trans Man": "opt_gender_trans_man",
  // Pronouns
  "She/Her": "opt_pronouns_she_her", "He/Him": "opt_pronouns_he_him", "They/Them": "opt_pronouns_they_them",
  // Caters to (Couples is shared with Services — service mapping wins above; we use a separate key here)
  "Men": "opt_caters_men", "Women": "opt_caters_women", "Couples": "opt_caters_couples",
  "Non-binary": "opt_caters_non_binary", "Everyone": "opt_caters_everyone",
};
const DAYS_OF_WEEK     = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const COUNTRY_OPTIONS  = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "BR", name: "Brazil" },
  { code: "AE", name: "UAE" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type ProfileForm = {
  username: string;
  bio: string;
  bio_long: string;
  tagline: string;
  age: string;
  nationality: string;
  languages: string[];
  height_cm: string;
  build: string;
  hair_color: string;
  eye_color: string;
  city: string;
  country_code: string;
  is_provider: boolean;
  provider_type: "creator" | "escort" | null;
  incall: boolean;
  outcall: boolean;
  hourly_rate: string;
  service_categories: string[];
  avatar_url: string | null;
  contact_whatsapp: string;
  contact_telegram: string;
  contact_phone: string;
  website_url: string;
  tiktok_url: string;
  snapchat_url: string;
  instagram_url: string;
  onlyfans_url: string;
  twitter_url: string;
  facebook_url: string;
  show_contact_details: boolean;
  show_social_links: boolean;
  hip_size: string;
  bust_size: string;
  bra_cup_size: string;
  gender: string;
  pronouns: string;
  caters_to: string[];
  availability_schedule: Record<string, string>;
};

const EMPTY_FORM: ProfileForm = {
  username: "", bio: "", bio_long: "", tagline: "", age: "", nationality: "",
  languages: [], height_cm: "", build: "", hair_color: "", eye_color: "",
  city: "", country_code: "CA", is_provider: false, provider_type: null, incall: true,
  outcall: true, hourly_rate: "", service_categories: [], avatar_url: null,
  contact_whatsapp: "", contact_telegram: "", contact_phone: "",
  website_url: "", tiktok_url: "", snapchat_url: "", instagram_url: "",
  onlyfans_url: "", twitter_url: "", facebook_url: "",
  show_contact_details: true, show_social_links: true,
  hip_size: "", bust_size: "", bra_cup_size: "",
  gender: "", pronouns: "", caters_to: [], availability_schedule: {},
};

// ─── Page ────────────────────────────────────────────────────────────────────

const DAY_KEYS: Record<string, TranslationKey> = {
  monday: "day_monday",
  tuesday: "day_tuesday",
  wednesday: "day_wednesday",
  thursday: "day_thursday",
  friday: "day_friday",
  saturday: "day_saturday",
  sunday: "day_sunday",
};

export default function EditProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: sessionLoading } = useSession();
  const { refetch } = useProfile();
  const [form, setForm]         = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load existing profile
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace("/auth/signin"); return; }

    supabase
      .from("profiles")
      .select("username, bio, bio_long, tagline, age, nationality, languages, height_cm, build, hair_color, eye_color, city, country_code, is_provider, provider_type, incall, outcall, hourly_rate, service_categories, avatar_url, contact_whatsapp, contact_telegram, contact_phone, website_url, tiktok_url, snapchat_url, instagram_url, onlyfans_url, twitter_url, facebook_url, show_contact_details, show_social_links, hip_size, bust_size, bra_cup_size, gender, pronouns, caters_to, availability_schedule")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            username:           data.username ?? "",
            bio:                data.bio ?? "",
            bio_long:           data.bio_long ?? "",
            tagline:            data.tagline ?? "",
            age:                data.age?.toString() ?? "",
            nationality:        data.nationality ?? "",
            languages:          data.languages ?? [],
            height_cm:          data.height_cm?.toString() ?? "",
            build:              data.build ?? "",
            hair_color:         data.hair_color ?? "",
            eye_color:          data.eye_color ?? "",
            city:               data.city ?? "",
            country_code:       data.country_code ?? "CA",
            is_provider:        data.is_provider ?? false,
            provider_type:      data.provider_type ?? null,
            incall:             data.incall ?? true,
            outcall:            data.outcall ?? true,
            hourly_rate:        data.hourly_rate ? String(Math.round(data.hourly_rate / 100)) : "",
            service_categories: data.service_categories ?? [],
            avatar_url:         data.avatar_url ?? null,
            contact_whatsapp:   data.contact_whatsapp ?? "",
            contact_telegram:   data.contact_telegram ?? "",
            contact_phone:      data.contact_phone ?? "",
            website_url:        data.website_url ?? "",
            tiktok_url:         data.tiktok_url ?? "",
            snapchat_url:       data.snapchat_url ?? "",
            instagram_url:      data.instagram_url ?? "",
            onlyfans_url:       data.onlyfans_url ?? "",
            twitter_url:        data.twitter_url ?? "",
            facebook_url:       data.facebook_url ?? "",
            show_contact_details: data.show_contact_details ?? true,
            show_social_links:  data.show_social_links ?? true,
            hip_size:           data.hip_size ?? "",
            bust_size:          data.bust_size ?? "",
            bra_cup_size:       data.bra_cup_size ?? "",
            gender:             data.gender ?? "",
            pronouns:           data.pronouns ?? "",
            caters_to:          data.caters_to ?? [],
            availability_schedule: data.availability_schedule ?? {},
          });
        }
        setLoading(false);
      });
  }, [user, sessionLoading, router]);

  function patch<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleArray(key: "languages" | "service_categories" | "caters_to", value: string) {
    setForm((f) => {
      const arr = f[key] as string[];
      return {
        ...f,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    // Preview immediately
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);

    try {
      const result = await uploadAvatar(user.id, file);
      if (!result.ok) {
        console.error("[profile/edit] avatar upload failed:", result.error);
        showToast("error", t("pe_err_photo"));
        setAvatarPreview(null);
      } else {
        patch("avatar_url", result.publicUrl);
      }
    } catch (err) {
      console.error("[profile/edit] avatar upload threw:", err);
      showToast("error", t("pe_err_photo"));
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user) return;

    // Validate age and height ranges
    const parsedAge = form.age ? parseInt(form.age, 10) : null;
    if (parsedAge !== null && (parsedAge < 18 || parsedAge > 99)) {
      showToast("error", t("pe_err_age"));
      return;
    }
    const parsedHeight = form.height_cm ? parseInt(form.height_cm, 10) : null;
    if (parsedHeight !== null && (parsedHeight < 140 || parsedHeight > 220)) {
      showToast("error", t("pe_err_height"));
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      username:           form.username.trim(),
      bio:                form.bio.trim() || null,
      bio_long:           form.bio_long.trim() || null,
      age:                parsedAge,
      nationality:        form.nationality.trim() || null,
      languages:          form.languages,
      height_cm:          parsedHeight,
      build:              form.build || null,
      hair_color:         form.hair_color || null,
      eye_color:          form.eye_color || null,
      city:               form.city.trim() || null,
      country_code:       form.country_code || null,
      provider_type:      form.provider_type,
      incall:             form.incall,
      outcall:            form.outcall,
      hourly_rate:        form.hourly_rate ? parseInt(form.hourly_rate, 10) * 100 : null,
      service_categories: form.service_categories,
      contact_whatsapp:   form.contact_whatsapp.trim() || null,
      contact_telegram:   form.contact_telegram.trim() || null,
      contact_phone:      form.contact_phone.trim() || null,
      website_url:        form.website_url.trim() || null,
      tiktok_url:         form.tiktok_url.trim() || null,
      snapchat_url:       form.snapchat_url.trim() || null,
      instagram_url:      form.instagram_url.trim() || null,
      onlyfans_url:       form.onlyfans_url.trim() || null,
      twitter_url:        form.twitter_url.trim() || null,
      facebook_url:       form.facebook_url.trim() || null,
      show_contact_details: form.show_contact_details,
      show_social_links:  form.show_social_links,
      hip_size:           form.hip_size.trim() || null,
      bust_size:          form.bust_size.trim() || null,
      bra_cup_size:       form.bra_cup_size.trim() || null,
      gender:             form.gender || null,
      pronouns:           form.pronouns || null,
      caters_to:          form.caters_to,
      tagline:            form.tagline.trim() || null,
      availability_schedule: Object.keys(form.availability_schedule).length > 0 ? form.availability_schedule : null,
    };

    if (form.avatar_url) payload.avatar_url = form.avatar_url;

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

    setSaving(false);
    if (error) {
      showToast("error", error.message.includes("profiles_username_key") ? t("pe_err_username_taken") : error.message);
    } else {
      refetch();
      showToast("success", t("pe_saved"));
      setTimeout(() => router.push(`/profile`), 1200);
    }
  }

  if (sessionLoading || loading) return <Skeleton />;

  const avatarSrc = avatarPreview ?? form.avatar_url;

  // Per-context label maps (some keys like "Other"/"Couples"/"Non-binary" appear in multiple groups)
  const buildLabels    = Object.fromEntries(BUILD_OPTIONS.map((o) => [o, t(OPTION_LABEL_KEYS[o])]));
  const hairLabels     = { ...Object.fromEntries(HAIR_OPTIONS.map((o) => [o, t(OPTION_LABEL_KEYS[o])])), Other: t("opt_hair_other") };
  const eyeLabels      = { ...Object.fromEntries(EYE_OPTIONS.map((o) => [o, t(OPTION_LABEL_KEYS[o])])), Other: t("opt_eye_other") };
  const serviceLabels  = Object.fromEntries(SERVICE_CATS.map((o) => [o, t(OPTION_LABEL_KEYS[o])]));
  const langLabels     = Object.fromEntries(LANGUAGES.map((o) => [o, t(OPTION_LABEL_KEYS[o])]));
  const genderLabels   = { ...Object.fromEntries(GENDER_OPTIONS.map((o) => [o, t(OPTION_LABEL_KEYS[o])])), Other: t("opt_gender_other"), "Non-binary": t("opt_gender_non_binary") };
  const pronounLabels  = Object.fromEntries(PRONOUN_OPTIONS.map((o) => [o, t(OPTION_LABEL_KEYS[o])]));
  const catersLabels   = Object.fromEntries(CATERS_TO_OPTIONS.map((o) => [o, t(OPTION_LABEL_KEYS[o])]));

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-10">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold shadow-xl transition-all",
          toast.type === "success"
            ? "bg-emerald-400 text-white"
            : "bg-red-500 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 hover:text-slate-700"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("pe_title")}</span>
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex h-8 items-center gap-1.5 rounded-full bg-pink-400 px-4 text-[13px] font-bold text-white shadow-[0_0_15px_rgba(244,114,182,0.3)] transition-all hover:bg-pink-300 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
          {t("pe_save")}
        </button>
      </header>

      {/* Avatar */}
      <div className="flex flex-col items-center py-8">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative"
        >
          <div className="rounded-full p-[3px] bg-gradient-to-tr from-pink-400 via-sky-300 to-violet-400 shadow-[0_0_24px_rgba(244,114,182,0.2)]">
            <div className="rounded-full p-[2px] bg-white">
              {avatarSrc ? (
                <div className="relative h-24 w-24 overflow-hidden rounded-full">
                  <Image src={avatarSrc} alt="Avatar" fill className="object-cover" sizes="96px" />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-pink-50 text-3xl font-bold text-pink-300">
                  {(form.username[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className={cn(
            "absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-pink-400 text-white shadow-md transition-transform group-hover:scale-110",
            uploading && "animate-pulse"
          )}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </div>
        </button>
        <p className="mt-3 text-[12px] text-slate-400">{t("pe_tap_photo")}</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      <div className="space-y-6 px-4">

        {/* ── Basic info ── */}
        <Section icon={User} title={t("pe_sec_basic")}>
          <Field label={t("pe_username")}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]">@</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => patch("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={30}
                placeholder={t("pe_username_ph")}
                className={cn(inputCls, "pl-8")}
              />
            </div>
            <Hint>{t("pe_username_hint")}</Hint>
          </Field>

          <Field label={t("pe_tagline")}>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => patch("tagline", e.target.value)}
              maxLength={80}
              placeholder={t("pe_tagline_ph")}
              className={inputCls}
            />
            <div className="flex justify-between">
              <Hint>{t("pe_tagline_hint")}</Hint>
              <Counter val={form.tagline.length} max={80} />
            </div>
          </Field>

          <Field label={t("pe_short_bio")}>
            <textarea
              value={form.bio}
              onChange={(e) => patch("bio", e.target.value)}
              maxLength={140}
              rows={2}
              placeholder={t("pe_short_bio_ph")}
              className={cn(inputCls, "resize-none")}
            />
            <div className="flex justify-end"><Counter val={form.bio.length} max={140} /></div>
          </Field>

          <Field label={t("pe_about_me")}>
            <textarea
              value={form.bio_long}
              onChange={(e) => patch("bio_long", e.target.value)}
              maxLength={600}
              rows={4}
              placeholder={t("pe_about_me_ph")}
              className={cn(inputCls, "resize-none")}
            />
            <div className="flex justify-end"><Counter val={form.bio_long.length} max={600} /></div>
          </Field>
        </Section>

        {/* ── Personal ── */}
        <Section icon={Globe} title={t("pe_sec_personal")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("pe_age")}>
              <input
                type="number" inputMode="numeric"
                value={form.age} onChange={(e) => patch("age", e.target.value)}
                min={18} max={99} placeholder="25"
                className={inputCls}
              />
            </Field>
            <Field label={t("pe_nationality")}>
              <input
                type="text"
                value={form.nationality} onChange={(e) => patch("nationality", e.target.value)}
                maxLength={40} placeholder={t("pe_nationality_ph")}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label={t("pe_languages")}>
            <ChipGroup
              options={LANGUAGES}
              selected={form.languages}
              onToggle={(v) => toggleArray("languages", v)}
              labelMap={langLabels}
            />
          </Field>
        </Section>

        {/* ── Physical ── */}
        <Section icon={Ruler} title={t("pe_sec_physical")}>
          <Field label={t("pe_height")}>
            <input
              type="number" inputMode="numeric"
              value={form.height_cm} onChange={(e) => patch("height_cm", e.target.value)}
              min={140} max={220} placeholder="168"
              className={inputCls}
            />
            {form.height_cm && !isNaN(parseInt(form.height_cm)) && (
              <Hint>{cmToFtIn(parseInt(form.height_cm))}</Hint>
            )}
          </Field>

          <Field label={t("pe_build")}>
            <ChipGroup options={BUILD_OPTIONS} selected={form.build ? [form.build] : []} onToggle={(v) => patch("build", form.build === v ? "" : v)} single labelMap={buildLabels} />
          </Field>

          <Field label={t("pe_hair")}>
            <ChipGroup options={HAIR_OPTIONS} selected={form.hair_color ? [form.hair_color] : []} onToggle={(v) => patch("hair_color", form.hair_color === v ? "" : v)} single labelMap={hairLabels} />
          </Field>

          <Field label={t("pe_eye")}>
            <ChipGroup options={EYE_OPTIONS} selected={form.eye_color ? [form.eye_color] : []} onToggle={(v) => patch("eye_color", form.eye_color === v ? "" : v)} single labelMap={eyeLabels} />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Bust">
              <input
                type="text"
                value={form.bust_size}
                onChange={(e) => patch("bust_size", e.target.value)}
                maxLength={20}
                placeholder="34"
                className={inputCls}
              />
            </Field>
            <Field label="Cup">
              <input
                type="text"
                value={form.bra_cup_size}
                onChange={(e) => patch("bra_cup_size", e.target.value)}
                maxLength={20}
                placeholder="C"
                className={inputCls}
              />
            </Field>
            <Field label="Hips">
              <input
                type="text"
                value={form.hip_size}
                onChange={(e) => patch("hip_size", e.target.value)}
                maxLength={20}
                placeholder="38"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ── Location ── */}
        <Section icon={MapPin} title={t("pe_sec_location")}>
          <Field label={t("pe_city")}>
            <input
              type="text"
              value={form.city} onChange={(e) => patch("city", e.target.value)}
              maxLength={60} placeholder={t("pe_city_ph")}
              className={inputCls}
            />
          </Field>
          <Field label={t("pe_country")}>
            <div className="relative">
              <select
                value={form.country_code}
                onChange={(e) => patch("country_code", e.target.value)}
                className={cn(inputCls, "appearance-none pr-9")}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>
        </Section>

        {/* ── Identity & preferences (providers) ── */}
        <Section icon={Heart} title={t("pe_sec_identity")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("pe_gender")}>
              <ChipGroup
                options={GENDER_OPTIONS}
                selected={form.gender ? [form.gender] : []}
                onToggle={(v) => patch("gender", form.gender === v ? "" : v)}
                single
                labelMap={genderLabels}
              />
            </Field>
            <Field label={t("pe_pronouns")}>
              <ChipGroup
                options={PRONOUN_OPTIONS}
                selected={form.pronouns ? [form.pronouns] : []}
                onToggle={(v) => patch("pronouns", form.pronouns === v ? "" : v)}
                single
                labelMap={pronounLabels}
              />
            </Field>
          </div>

          <Field label={t("pe_caters_to")}>
            <ChipGroup
              options={CATERS_TO_OPTIONS}
              selected={form.caters_to}
              onToggle={(v) => toggleArray("caters_to", v)}
              labelMap={catersLabels}
            />
            <Hint>{t("pe_caters_hint")}</Hint>
          </Field>
        </Section>

        {/* ── Weekly availability ── */}
        <Section icon={Calendar} title={t("pe_sec_availability")}>
          <Hint>{t("pe_avail_hint")}</Hint>
          <div className="mt-2 space-y-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-16 text-[12px] font-medium text-slate-400">{t(DAY_KEYS[day])}</span>
                <input
                  type="text"
                  value={form.availability_schedule[day] ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      availability_schedule: { ...f.availability_schedule, [day]: e.target.value },
                    }))
                  }
                  placeholder={t("pe_avail_ph")}
                  maxLength={30}
                  className={cn(inputCls, "flex-1 py-2.5 text-[13px]")}
                />
              </div>
            ))}
          </div>
          <Hint>{t("pe_avail_examples")}</Hint>
        </Section>

        {/* ── Provider settings ── */}
        <Section icon={Sparkles} title={t("pe_sec_services")}>
          {/* Provider type display — read-only badge */}
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <div>
              <p className="text-[14px] font-semibold text-slate-800">{t("pe_account_type")}</p>
              <p className="text-[12px] text-slate-400">
                {form.provider_type === "escort" ? t("pe_type_escort") : form.provider_type === "creator" ? t("pe_type_creator") : t("pe_type_client")}
              </p>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-bold",
              form.provider_type === "escort" ? "bg-pink-50 text-pink-500"
                : form.provider_type === "creator" ? "bg-violet-50 text-violet-500"
                : "bg-gray-100 text-slate-400"
            )}>
              {form.provider_type === "escort" ? t("pe_type_escort") : form.provider_type === "creator" ? t("pe_type_creator") : t("pe_type_client")}
            </span>
          </div>

          {/* Escort-only fields: incall/outcall, rate, categories */}
          {form.provider_type === "escort" && (
            <div className="space-y-4 pt-1">
              {/* Incall / Outcall */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3.5">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">{t("pe_incall")}</p>
                    <p className="text-[10px] text-slate-400">{t("pe_incall_desc")}</p>
                  </div>
                  <Toggle checked={form.incall} onChange={(v) => patch("incall", v)} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3.5">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">{t("pe_outcall")}</p>
                    <p className="text-[10px] text-slate-400">{t("pe_outcall_desc")}</p>
                  </div>
                  <Toggle checked={form.outcall} onChange={(v) => patch("outcall", v)} />
                </div>
              </div>

              {/* Hourly rate */}
              <Field label={t("pe_hourly_rate")}>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-slate-400">CA$</span>
                  <input
                    type="number" inputMode="numeric"
                    value={form.hourly_rate} onChange={(e) => patch("hourly_rate", e.target.value)}
                    min={1} placeholder="200"
                    className={cn(inputCls, "pl-12")}
                  />
                </div>
                <Hint>{t("pe_hourly_hint")}</Hint>
              </Field>

              {/* Service categories */}
              <Field label={t("pe_service_cats")}>
                <ChipGroup
                  options={SERVICE_CATS}
                  selected={form.service_categories}
                  onToggle={(v) => toggleArray("service_categories", v)}
                  labelMap={serviceLabels}
                />
                <Hint>{t("pe_service_cats_hint")}</Hint>
              </Field>
            </div>
          )}

          {/* Contact methods — both creator and escort */}
          {form.provider_type != null && (
            <div className="space-y-4 pt-1">
              {/* Contact methods */}
              <Field label={t("pe_whatsapp")}>
                <input
                  type="tel" inputMode="tel"
                  value={form.contact_whatsapp}
                  onChange={(e) => patch("contact_whatsapp", e.target.value)}
                  placeholder="+1 555 123 4567"
                  maxLength={20}
                  className={inputCls}
                />
                <Hint>{t("pe_whatsapp_hint")}</Hint>
              </Field>

              <Field label={t("pe_telegram")}>
                <input
                  type="text"
                  value={form.contact_telegram}
                  onChange={(e) => patch("contact_telegram", e.target.value)}
                  placeholder={t("pe_telegram_ph")}
                  maxLength={40}
                  className={inputCls}
                />
                <Hint>{t("pe_telegram_hint")}</Hint>
              </Field>

              <Field label={t("pe_phone")}>
                <input
                  type="tel" inputMode="tel"
                  value={form.contact_phone}
                  onChange={(e) => patch("contact_phone", e.target.value)}
                  placeholder="+1 555 123 4567"
                  maxLength={20}
                  className={inputCls}
                />
                <Hint>{t("pe_phone_hint")}</Hint>
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Show contact details</p>
                  <p className="text-[10px] text-slate-400">Controls phone and website visibility on your public profile.</p>
                </div>
                <Toggle checked={form.show_contact_details} onChange={(v) => patch("show_contact_details", v)} />
              </div>

              <Field label="Website">
                <input
                  type="url"
                  value={form.website_url}
                  onChange={(e) => patch("website_url", e.target.value)}
                  placeholder="https://example.com"
                  maxLength={120}
                  className={inputCls}
                />
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Show social links</p>
                  <p className="text-[10px] text-slate-400">Keep all social handles optional and easy to hide.</p>
                </div>
                <Toggle checked={form.show_social_links} onChange={(v) => patch("show_social_links", v)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([
                  ["instagram_url", "Instagram"],
                  ["tiktok_url", "TikTok"],
                  ["snapchat_url", "Snapchat"],
                  ["onlyfans_url", "OnlyFans"],
                  ["twitter_url", "Twitter/X"],
                  ["facebook_url", "Facebook"],
                ] as const).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => patch(key, e.target.value)}
                      placeholder="@handle or URL"
                      maxLength={120}
                      className={inputCls}
                    />
                  </Field>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── Verification nudge ── */}
        <div className="flex items-center gap-3 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-4">
          <Shield size={18} className="flex-shrink-0 text-pink-500" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-800">{t("pe_get_verified")}</p>
            <p className="text-[11px] text-slate-400">{t("pe_get_verified_desc")}</p>
          </div>
          <button
            onClick={() => router.push("/profile/verify")}
            className="rounded-full border border-pink-300 px-3 py-1.5 text-[11px] font-semibold text-pink-500 hover:bg-pink-100"
          >
            {t("pe_apply")}
          </button>
        </div>

        {/* Bottom save button */}
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-400 py-4 text-[15px] font-bold text-white shadow-[0_0_25px_rgba(244,114,182,0.25)] transition-all hover:bg-pink-300 active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
          {saving ? t("pe_saving") : t("pe_save_profile")}
        </button>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={13} className="text-pink-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-slate-300">{children}</p>;
}

function Counter({ val, max }: { val: number; max: number }) {
  return <span className="text-[10px] text-slate-300">{val}/{max}</span>;
}

function ChipGroup({
  options, selected, onToggle, labelMap,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
  labelMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
              active
                ? "border-pink-300 bg-pink-50 text-pink-500"
                : "border-gray-200 bg-gray-50 text-slate-400 hover:border-gray-300 hover:text-slate-600"
            )}
          >
            {labelMap?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-pink-400" : "bg-gray-300"
      )}
    >
      <span className={cn(
        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

function cmToFtIn(cm: number): string {
  const totalIn = Math.round(cm / 2.54);
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  return `${ft}'${inches}" (${cm} cm)`;
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-slate-800 placeholder-slate-300 outline-none transition focus:border-pink-300 focus:ring-1 focus:ring-pink-200";

function Skeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-[#fafbfc]">
      <div className="h-[53px] border-b border-gray-200" />
      <div className="flex flex-col items-center pt-8 pb-6 gap-3">
        <div className="h-24 w-24 rounded-full bg-gray-100" />
        <div className="h-3 w-28 rounded-full bg-gray-100" />
      </div>
      <div className="space-y-4 px-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-32 rounded-2xl bg-gray-50" />)}
      </div>
    </div>
  );
}
