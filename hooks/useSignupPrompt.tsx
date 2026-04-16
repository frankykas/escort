"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { SignupPromptModal, type PromptAction } from "@/components/ui/SignupPromptModal";

export function useSignupPrompt() {
  const { user } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<PromptAction>("message");

  const promptIfGuest = useCallback(
    (act: PromptAction): boolean => {
      if (user) return false;
      setAction(act);
      setOpen(true);
      return true;
    },
    [user],
  );

  const modal = (
    <SignupPromptModal
      open={open}
      onClose={() => setOpen(false)}
      action={action}
      redirectPath={pathname}
    />
  );

  return { promptIfGuest, modal };
}
