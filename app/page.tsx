import { USE_SOCIAL_FEED } from "@/lib/features";
import { ClassicHome } from "@/components/classic/ClassicHome";
import { SocialHome } from "@/components/social/SocialHome";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default function Page({ searchParams }: Props) {
  return USE_SOCIAL_FEED ? <SocialHome searchParams={searchParams} /> : <ClassicHome />;
}
