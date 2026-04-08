// ─── Category System ─────────────────────────────────────────────────────────
// Central config for all browsable categories.
// Each category maps to a Supabase filter so the same page template can
// render any category with the right providers.

export type CategoryFilter =
  | { type: "service"; value: string }       // service_categories @> [value]
  | { type: "hair"; value: string }          // hair_color = value
  | { type: "build"; value: string }         // build = value
  | { type: "age_min"; value: number }       // age >= value
  | { type: "gender"; value: string }        // gender = value
  | { type: "caters_to"; value: string }     // caters_to @> [value]
  | { type: "tag"; value: string };          // service_categories @> [value] (lifestyle/kink tags)

export type Category = {
  slug: string;
  label: string;
  shortLabel: string;       // For chips/pills
  description: string;      // Shown on category page
  emoji: string;            // Visual identifier (used in grid only, not in UI chrome)
  filter: CategoryFilter;
  color: string;            // Tailwind gradient from-color
  featured?: boolean;       // Show in the main grid on explore
};

export const CATEGORIES: Category[] = [
  // ── Service-based ──
  {
    slug: "companionship",
    label: "Companionship Escorts",
    shortLabel: "Companionship",
    description: "Providers offering companionship services for any occasion.",
    emoji: "💎",
    filter: { type: "service", value: "Companionship" },
    color: "from-violet-600 to-purple-900",
    featured: true,
  },
  {
    slug: "gfe",
    label: "GFE Escorts",
    shortLabel: "GFE",
    description: "The girlfriend experience — warmth, connection, and chemistry.",
    emoji: "💕",
    filter: { type: "service", value: "GFE" },
    color: "from-pink-600 to-rose-900",
    featured: true,
  },
  {
    slug: "massage",
    label: "Massage Escorts",
    shortLabel: "Massage",
    description: "Skilled providers offering relaxation and body work.",
    emoji: "🧖‍♀️",
    filter: { type: "service", value: "Massage" },
    color: "from-teal-600 to-emerald-900",
    featured: true,
  },
  {
    slug: "bdsm",
    label: "BDSM Escorts",
    shortLabel: "BDSM",
    description: "Explore kink, power dynamics, and alternative play.",
    emoji: "⛓️",
    filter: { type: "service", value: "BDSM" },
    color: "from-red-700 to-red-950",
    featured: true,
  },
  {
    slug: "domination",
    label: "Domination Escorts",
    shortLabel: "Domination",
    description: "Professional dominatrixes and power exchange specialists.",
    emoji: "👑",
    filter: { type: "service", value: "Domination" },
    color: "from-amber-700 to-amber-950",
    featured: true,
  },
  {
    slug: "couples",
    label: "Couples Escorts",
    shortLabel: "Couples",
    description: "Providers who welcome couples and shared experiences.",
    emoji: "👫",
    filter: { type: "service", value: "Couples" },
    color: "from-sky-600 to-blue-900",
    featured: true,
  },
  {
    slug: "dinner-date",
    label: "Dinner Date Escorts",
    shortLabel: "Dinner Date",
    description: "Elegant companions for fine dining and social events.",
    emoji: "🍷",
    filter: { type: "service", value: "Dinner Date" },
    color: "from-orange-600 to-orange-900",
  },
  {
    slug: "travel",
    label: "Travel Escorts",
    shortLabel: "Travel",
    description: "Adventurous companions available for trips and getaways.",
    emoji: "✈️",
    filter: { type: "service", value: "Travel" },
    color: "from-cyan-600 to-cyan-900",
  },
  {
    slug: "tantric",
    label: "Tantric Escorts",
    shortLabel: "Tantric",
    description: "Spiritual and sensual tantric experiences.",
    emoji: "🕉️",
    filter: { type: "service", value: "Tantric" },
    color: "from-fuchsia-600 to-fuchsia-950",
  },
  {
    slug: "pse",
    label: "PSE Escorts",
    shortLabel: "PSE",
    description: "The porn star experience — bold and uninhibited.",
    emoji: "🔥",
    filter: { type: "service", value: "PSE" },
    color: "from-orange-600 to-red-900",
  },
  {
    slug: "420-friendly",
    label: "420-Friendly Escorts",
    shortLabel: "420-Friendly",
    description: "Cannabis-friendly providers for a relaxed experience.",
    emoji: "🌿",
    filter: { type: "tag", value: "420-Friendly" },
    color: "from-green-600 to-green-900",
    featured: true,
  },
  {
    slug: "fetish",
    label: "Fetish Escorts",
    shortLabel: "Fetish",
    description: "Specialists in niche interests and fetish play.",
    emoji: "🎭",
    filter: { type: "tag", value: "Fetish" },
    color: "from-purple-700 to-purple-950",
  },

  // ── Appearance-based ──
  {
    slug: "mature",
    label: "Mature Escorts",
    shortLabel: "Mature",
    description: "Experienced providers who know exactly what they're doing.",
    emoji: "🥂",
    filter: { type: "age_min", value: 35 },
    color: "from-amber-600 to-amber-900",
    featured: true,
  },
  {
    slug: "redhead",
    label: "Redhead Escorts",
    shortLabel: "Redheads",
    description: "Fiery redheads and auburn beauties.",
    emoji: "🔴",
    filter: { type: "hair", value: "Red" },
    color: "from-red-600 to-red-900",
  },
  {
    slug: "blonde",
    label: "Blonde Escorts",
    shortLabel: "Blondes",
    description: "Beautiful blonde providers.",
    emoji: "💛",
    filter: { type: "hair", value: "Blonde" },
    color: "from-yellow-500 to-amber-800",
  },
  {
    slug: "brunette",
    label: "Brunette Escorts",
    shortLabel: "Brunettes",
    description: "Stunning brunette providers.",
    emoji: "🤎",
    filter: { type: "hair", value: "Brunette" },
    color: "from-amber-800 to-amber-950",
  },
  {
    slug: "petite",
    label: "Petite Escorts",
    shortLabel: "Petite",
    description: "Petite and perfectly formed providers.",
    emoji: "✨",
    filter: { type: "build", value: "Petite" },
    color: "from-pink-500 to-pink-900",
  },
  {
    slug: "curvy",
    label: "Curvy Escorts",
    shortLabel: "Curvy",
    description: "Curvy and confident providers who celebrate their figure.",
    emoji: "🍑",
    filter: { type: "build", value: "Curvy" },
    color: "from-rose-600 to-rose-900",
  },
  {
    slug: "athletic",
    label: "Athletic Escorts",
    shortLabel: "Athletic",
    description: "Fit and toned providers who take care of their body.",
    emoji: "💪",
    filter: { type: "build", value: "Athletic" },
    color: "from-emerald-600 to-emerald-900",
  },

  // ── Gender / identity ──
  {
    slug: "trans",
    label: "Trans Escorts",
    shortLabel: "Trans",
    description: "Trans providers in your area.",
    emoji: "🏳️‍⚧️",
    filter: { type: "gender", value: "Trans Woman" },
    color: "from-blue-500 to-pink-600",
    featured: true,
  },
  {
    slug: "male",
    label: "Male Escorts",
    shortLabel: "Male",
    description: "Male providers and companions.",
    emoji: "♂️",
    filter: { type: "gender", value: "Man" },
    color: "from-blue-600 to-blue-900",
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getFeaturedCategories(): Category[] {
  return CATEGORIES.filter((c) => c.featured);
}
