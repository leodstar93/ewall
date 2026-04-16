import { Suspense } from "react";
import InvitePageClient from "./invite-client";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <InvitePageClientWrapper params={params} />
    </Suspense>
  );
}

async function InvitePageClientWrapper({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitePageClient token={token} />;
}
