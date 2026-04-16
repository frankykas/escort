"use client";

/**
 * OnboardingTour — role-aware first-time spotlight tour.
 *
 * Renders different tours for clients vs. providers. Each tour runs once per
 * user (tracked in localStorage). Drop this anywhere in the layout — it
 * mounts itself only after onboarding has completed.
 */

import { SpotlightTour, type TourStep } from "./SpotlightTour";
import { useProfile } from "@/contexts/ProfileContext";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function OnboardingTour() {
  const { profile, isProvider, loading } = useProfile();
  const { t } = useTranslation();

  const PROVIDER_STEPS: TourStep[] = [
    { target: "nav-u",        title: t("tour_p_welcome_title"),  body: t("tour_p_welcome_body") },
    { target: "nav-messages", title: t("tour_p_messages_title"), body: t("tour_p_messages_body") },
    { target: "nav-create",   title: t("tour_p_create_title"),   body: t("tour_p_create_body") },
    { target: "nav-explore",  title: t("tour_p_explore_title"),  body: t("tour_p_explore_body") },
    { target: "nav-profile",  title: t("tour_p_profile_title"),  body: t("tour_p_profile_body") },
  ];

  const CLIENT_STEPS: TourStep[] = [
    { target: "nav-home",     title: t("tour_c_welcome_title"),  body: t("tour_c_welcome_body") },
    { target: "nav-explore",  title: t("tour_c_explore_title"),  body: t("tour_c_explore_body") },
    { target: "nav-messages", title: t("tour_c_messages_title"), body: t("tour_c_messages_body") },
    { target: "nav-profile",  title: t("tour_c_profile_title"),  body: t("tour_c_profile_body") },
  ];

  // Don't run until profile is loaded and onboarding is complete
  if (loading || !profile) return null;
  if (!profile.onboarding_completed) return null;

  // Scope the storage key by user id so a brand-new account always gets the
  // tour, even if another account on the same browser already completed it.
  const role = isProvider ? "provider" : "client";
  const storageKey = `${role}-tour-v1:${profile.id}`;

  return (
    <SpotlightTour
      steps={isProvider ? PROVIDER_STEPS : CLIENT_STEPS}
      storageKey={storageKey}
    />
  );
}
