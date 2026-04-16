"use client";

import dynamic from "next/dynamic";

// Cosmetic + idle components — defer so they don't block first paint or
// inflate the initial JS payload. None of these affect the LCP element.
//   • AmbientAura: scroll-driven gold glow (purely decorative)
//   • OnboardingTour: only fires for first-time users, after a 600ms timer
//   • PushPermissionPrompt: appears 4s after sign-in
const AmbientAura = dynamic(
  () => import("@/components/ui/AmbientEffects").then((m) => ({ default: m.AmbientAura })),
  { ssr: false }
);
const OnboardingTour = dynamic(
  () => import("@/components/ui/OnboardingTour").then((m) => ({ default: m.OnboardingTour })),
  { ssr: false }
);
const PushPermissionPrompt = dynamic(
  () => import("@/components/ui/PushPermissionPrompt").then((m) => ({ default: m.PushPermissionPrompt })),
  { ssr: false }
);

export function ClientShell() {
  return (
    <>
      <AmbientAura />
      <OnboardingTour />
      <PushPermissionPrompt />
    </>
  );
}
