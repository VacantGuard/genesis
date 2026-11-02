import { LaunchAnticipation } from "@/components/launch-anticipation";
import { deskIsOpen } from "@/lib/go-live";

export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  if (!deskIsOpen()) return <LaunchAnticipation />;
  return children;
}
