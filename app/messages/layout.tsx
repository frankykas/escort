import { StreamChatProvider } from "@/contexts/StreamChatContext";
import type { ReactNode } from "react";

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return <StreamChatProvider>{children}</StreamChatProvider>;
}
