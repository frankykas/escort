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
import { compressImage } from "@/lib/image";

// ─── Constants ───────────────────────────────────────────────────────────────

const BUILD_OPTIONS    = ["Slim", "Petite", "Athletic", "Average", "Curvy", "Plus-size"];
const HAIR_OPTIONS     = ["Blonde", "Brunette", "Black", "Red", "Auburn", "Silver", "Other"];
const EYE_OPTIONS      = ["Brown", "Blue", "Green", "Hazel", "Grey", "Amber", "Other"];
const SERVICE_CATS     = ["Companionship", "Dinner Date", "Travel", "GFE", "Couples", "Massage", "Domination"];
const LANGUAGES        = ["English", "French", "Spanish", "Portuguese", "Italian", "Russian", "Arabic", "Mandarin", "Japanese", "German", "Hindi", "Korean"];
const GENDER_OPTIONS   = ["Woman", "Man", "Trans Woman", "Trans Man", "Non-binary", "Other"];
const PRONOUN_OPTIONS  = ["She/Her", "He/Him", "They/Them"];
const CATERS_TO_OPTIONS = ["Men", "Women", "Couples", "Non-binary", "Everyone"];
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
  incall: boolean;
  outcall: boolean;
  hourly_rate: string;
  service_categories: string[];
  avatar_url: string | null;
  contact_whatsapp: string;
  contact_telegram: string;
  contact_phone: string;
  gender: string;
  pronouns: string;
  caters_to: string[];
  availability_schedule: Record<string, string>;
};

const EMPTY_FORM: ProfileForm = {
  username: "", bio: "", bio_long: "", tagline: "", age: "", nationality: "",
  languages: [], height_cm: "", build: "", hair_color: "", eye_color: "",
  city: "", country_code: "CA", is_provider: false, incall: true,
  outcall: true, hourly_rate: "", service_categories: [], avatar_url: null,
  contact_whatsapp: "", contact_telegram: "", contact_phone: "",
  gender: "", pronouns: "", caters_to: [], availability_schedule: {},
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const router = useRouter();
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
      .select("username, bio, bio_long, tagline, age, nationality, languages, height_cm, build, hair_color, eye_color, city, country_code, is_provider, incall, outcall, hourly_rate, service_categories, avatar_url, contact_whatsapp, contact_telegram, contact_phone, gender, pronouns, caters_to, availability_schedule")
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
            incall:             data.incall ?? true,
            outcall:            data.outcall ?? true,
            hourly_rate:        data.hourly_rate ? String(Math.round(data.hourly_rate / 100)) : "",
            service_categories: data.service_categories ?? [],
            avatar_url:         data.avatar_url ?? null,
            contact_whatsapp:   data.contact_whatsapp ?? "",
            contact_telegram:   data.contact_telegram ?? "",
            contact_phone:      data.contact_phone ?? "",
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

    // Avatars are smaller — 800px is plenty
    const compressed = await compressImage(file, { maxDimension: 800, quality: 0.85 });
    const ext  = compressed.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, compressed, { upsert: true, contentType: compressed.type });

    if (uploadError) {
      showToast("error", "Photo upload failed. Try again.");
      setAvatarPreview(null);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    patch("avatar_url", publicUrl);
    setUploading(false);
  }

  async function handleSave() {
    if (!user) return;

    // Validate age and height ranges
    const parsedAge = form.age ? parseInt(form.age, 10) : null;
    if (parsedAge !== null && (parsedAge < 18 || parsedAge > 99)) {
      showToast("error", "Age must be between 18 and 99.");
      return;
    }
    const parsedHeight = form.height_cm ? parseInt(form.height_cm, 10) : null;
    if (parsedHeight !== null && (parsedHeight < 140 || parsedHeight > 220)) {
      showToast("error", "Height must be between 140 and 220 cm.");
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
      is_provider:        form.is_provider,
      incall:             form.incall,
      outcall:            form.outcall,
      hourly_rate:        form.hourly_rate ? parseInt(form.hourly_rate, 10) * 100 : null,
      service_categories: form.service_categories,
      contact_whatsapp:   form.contact_whatsapp.trim() || null,
      contact_telegram:   form.contact_telegram.trim() || null,
      contact_phone:      form.contact_phone.trim() || null,
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
      showToast("error", error.message.includes("profiles_username_key") ? "That username is taken." : error.message);
    } else {
      refetch();
      showToast("success", "Profile saved!");
      setTimeout(() => router.push(`/profile`), 1200);
    }
  }

  if (sessionLoading || loading) return <Skeleton />;

  const avatarSrc = avatarPreview ?? form.avatar_url;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black pb-10">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold shadow-xl transition-all",
          toast.type === "success"
            ? "bg-emerald-400 text-zinc-950"
            : "bg-red-500 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-[15px] font-semibold text-white">Edit Profile</span>
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex h-8 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-[13px] font-bold text-zinc-950 shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all hover:bg-amber-300 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
          Save
        </button>
      </header>

      {/* Avatar */}
      <div className="flex flex-col items-center py-8">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative"
        >
          <div className="rounded-full p-[3px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_24px_rgba(251,191,36,0.2)]">
            <div className="rounded-full p-[2px] bg-zinc-950">
              {avatarSrc ? (
                <div className="relative h-24 w-24 overflow-hidden rounded-full">
                  <Image src={avatarSrc} alt="Avatar" fill className="object-cover" sizes="96px" />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-3xl font-bold text-zinc-500">
                  {(form.username[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className={cn(
            "absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-md transition-transform group-hover:scale-110",
            uploading && "animate-pulse"
          )}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </div>
        </button>
        <p className="mt-3 text-[12px] text-zinc-500">Tap to change photo</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      <div className="space-y-6 px-4">

        {/* ── Basic info ── */}
        <Section icon={User} title="Basic info">
          <Field label="Username">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-[14px]">@</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => patch("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={30}
                placeholder="yourname"
                className={cn(inputCls, "pl-8")}
              />
            </div>
            <Hint>3–30 characters. Letters, numbers and underscores only.</Hint>
          </Field>

          <Field label="Tagline">
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => patch("tagline", e.target.value)}
              maxLength={80}
              placeholder="Your catchy headline…"
              className={inputCls}
            />
            <div className="flex justify-between">
              <Hint>A short headline shown on your profile card.</Hint>
              <Counter val={form.tagline.length} max={80} />
            </div>
          </Field>

          <Field label="Short bio">
            <textarea
              value={form.bio}
              onChange={(e) => patch("bio", e.target.value)}
              maxLength={140}
              rows={2}
              placeholder="One line about you…"
              className={cn(inputCls, "resize-none")}
            />
            <div className="flex justify-end"><Counter val={form.bio.length} max={140} /></div>
          </Field>

          <Field label="About me">
            <textarea
              value={form.bio_long}
              onChange={(e) => patch("bio_long", e.target.value)}
              maxLength={600}
              rows={4}
              placeholder="Tell visitors more about yourself, your personality, and what to expect…"
              className={cn(inputCls, "resize-none")}
            />
            <div className="flex justify-end"><Counter val={form.bio_long.length} max={600} /></div>
          </Field>
        </Section>

        {/* ── Personal ── */}
        <Section icon={Globe} title="Personal details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <input
                type="number" inputMode="numeric"
                value={form.age} onChange={(e) => patch("age", e.target.value)}
                min={18} max={99} placeholder="25"
                className={inputCls}
              />
            </Field>
            <Field label="Nationality">
              <input
                type="text"
                value={form.nationality} onChange={(e) => patch("nationality", e.target.value)}
                maxLength={40} placeholder="e.g. Canadian"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Languages spoken">
            <ChipGroup
              options={LANGUAGES}
              selected={form.languages}
              onToggle={(v) => toggleArray("languages", v)}
            />
          </Field>
        </Section>

        {/* ── Physical ── */}
        <Section icon={Ruler} title="Physical appearance">
          <Field label="Height (cm)">
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

          <Field label="Build">
            <ChipGroup options={BUILD_OPTIONS} selected={form.build ? [form.build] : []} onToggle={(v) => patch("build", form.build === v ? "" : v)} single />
          </Field>

          <Field label="Hair colour">
            <ChipGroup options={HAIR_OPTIONS} selected={form.hair_color ? [form.hair_color] : []} onToggle={(v) => patch("hair_color", form.hair_color === v ? "" : v)} single />
          </Field>

          <Field label="Eye colour">
            <ChipGroup options={EYE_OPTIONS} selected={form.eye_color ? [form.eye_color] : []} onToggle={(v) => patch("eye_color", form.eye_color === v ? "" : v)} single />
          </Field>
        </Section>

        {/* ── Location ── */}
        <Section icon={MapPin} title="Location">
          <Field label="City">
            <input
              type="text"
              value={form.city} onChange={(e) => patch("city", e.target.value)}
              maxLength={60} placeholder="e.g. Toronto"
              className={inputCls}
            />
          </Field>
          <Field label="Country">
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
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            </div>
          </Field>
        </Section>

        {/* ── Identity & preferences (providers) ── */}
        <Section icon={Heart} title="Identity & preferences">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <ChipGroup
                options={GENDER_OPTIONS}
                selected={form.gender ? [form.gender] : []}
                onToggle={(v) => patch("gender", form.gender === v ? "" : v)}
                single
              />
            </Field>
            <Field label="Pronouns">
              <ChipGroup
                options={PRONOUN_OPTIONS}
                selected={form.pronouns ? [form.pronouns] : []}
                onToggle={(v) => patch("pronouns", form.pronouns === v ? "" : v)}
                single
              />
            </Field>
          </div>

          <Field label="Caters to">
            <ChipGroup
              options={CATERS_TO_OPTIONS}
              selected={form.caters_to}
              onToggle={(v) => toggleArray("caters_to", v)}
            />
            <Hint>Select the client types you see.</Hint>
          </Field>
        </Section>

        {/* ── Weekly availability ── */}
        <Section icon={Calendar} title="Weekly availability">
          <Hint>Set your typical hours for each day. Leave blank for days you&apos;re unavailable.</Hint>
          <div className="mt-2 space-y-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-16 text-[12px] font-medium capitalize text-zinc-400">{day}</span>
                <input
                  type="text"
                  value={form.availability_schedule[day] ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      availability_schedule: { ...f.availability_schedule, [day]: e.target.value },
                    }))
                  }
                  placeholder="e.g. 10am – 8pm"
                  maxLength={30}
                  className={cn(inputCls, "flex-1 py-2.5 text-[13px]")}
                />
              </div>
            ))}
          </div>
          <Hint>Examples: &quot;All day&quot;, &quot;10am – 8pm&quot;, &quot;Evenings only&quot;, or leave blank</Hint>
        </Section>

        {/* ── Provider settings ── */}
        <Section icon={Sparkles} title="Services & rates">
          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/60 px-4 py-4">
            <div>
              <p className="text-[14px] font-semibold text-white">I offer services</p>
              <p className="text-[12px] text-zinc-500">Show listings, rates and appear in Explore</p>
            </div>
            <Toggle checked={form.is_provider} onChange={(v) => patch("is_provider", v)} />
          </div>

          {form.is_provider && (
            <div className="space-y-4 pt-1">
              {/* Incall / Outcall */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/60 px-3 py-3.5">
                  <div>
                    <p className="text-[13px] font-medium text-white">In-call</p>
                    <p className="text-[10px] text-zinc-500">At my location</p>
                  </div>
                  <Toggle checked={form.incall} onChange={(v) => patch("incall", v)} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/60 px-3 py-3.5">
                  <div>
                    <p className="text-[13px] font-medium text-white">Out-call</p>
                    <p className="text-[10px] text-zinc-500">At your location</p>
                  </div>
                  <Toggle checked={form.outcall} onChange={(v) => patch("outcall", v)} />
                </div>
              </div>

              {/* Hourly rate */}
              <Field label="Hourly rate">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-zinc-400">CA$</span>
                  <input
                    type="number" inputMode="numeric"
                    value={form.hourly_rate} onChange={(e) => patch("hourly_rate", e.target.value)}
                    min={1} placeholder="200"
                    className={cn(inputCls, "pl-12")}
                  />
                </div>
                <Hint>Displayed on your Explore card and profile. Stored in CA$.</Hint>
              </Field>

              {/* Service categories */}
              <Field label="Service categories">
                <ChipGroup
                  options={SERVICE_CATS}
                  selected={form.service_categories}
                  onToggle={(v) => toggleArray("service_categories", v)}
                />
                <Hint>These appear as filters in Explore.</Hint>
              </Field>

              {/* Contact methods */}
              <Field label="WhatsApp number">
                <input
                  type="tel" inputMode="tel"
                  value={form.contact_whatsapp}
                  onChange={(e) => patch("contact_whatsapp", e.target.value)}
                  placeholder="+1 555 123 4567"
                  maxLength={20}
                  className={inputCls}
                />
                <Hint>Full number with country code. Shown as a contact option on your profile.</Hint>
              </Field>

              <Field label="Telegram handle">
                <input
                  type="text"
                  value={form.contact_telegram}
                  onChange={(e) => patch("contact_telegram", e.target.value)}
                  placeholder="@yourtelegram"
                  maxLength={40}
                  className={inputCls}
                />
                <Hint>Your Telegram username. Clients can message you directly.</Hint>
              </Field>

              <Field label="Phone number">
                <input
                  type="tel" inputMode="tel"
                  value={form.contact_phone}
                  onChange={(e) => patch("contact_phone", e.target.value)}
                  placeholder="+1 555 123 4567"
                  maxLength={20}
                  className={inputCls}
                />
                <Hint>Optional. Shown as a call button on your profile. Only add if you want clients to call you.</Hint>
              </Field>
            </div>
          )}
        </Section>

        {/* ── Verification nudge ── */}
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/10 bg-amber-400/5 px-4 py-4">
          <Shield size={18} className="flex-shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-white">Get verified</p>
            <p className="text-[11px] text-zinc-500">A gold checkmark builds trust and boosts your visibility.</p>
          </div>
          <button
            onClick={() => router.push("/profile/verify")}
            className="rounded-full border border-amber-400/30 px-3 py-1.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-400/10"
          >
            Apply
          </button>
        </div>

        {/* Bottom save button */}
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-[15px] font-bold text-zinc-950 shadow-[0_0_25px_rgba(251,191,36,0.25)] transition-all hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
          {saving ? "Saving…" : "Save profile"}
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
        <Icon size={13} className="text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{title}</span>
      </div>
      <div className="space-y-3 rounded-2xl border border-white/5 bg-zinc-900/50 px-4 py-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-zinc-600">{children}</p>;
}

function Counter({ val, max }: { val: number; max: number }) {
  return <span className="text-[10px] text-zinc-600">{val}/{max}</span>;
}

function ChipGroup({
  options, selected, onToggle, single = false,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
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
                ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
            )}
          >
            {opt}
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
        checked ? "bg-amber-400" : "bg-zinc-700"
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
  "w-full rounded-xl border border-white/8 bg-zinc-900 px-4 py-3 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20";

function Skeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-zinc-950">
      <div className="h-[53px] border-b border-zinc-900" />
      <div className="flex flex-col items-center pt-8 pb-6 gap-3">
        <div className="h-24 w-24 rounded-full bg-zinc-800" />
        <div className="h-3 w-28 rounded-full bg-zinc-800" />
      </div>
      <div className="space-y-4 px-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-32 rounded-2xl bg-zinc-900" />)}
      </div>
    </div>
  );
}
