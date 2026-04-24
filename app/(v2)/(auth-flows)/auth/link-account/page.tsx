"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Suspense } from "react";

function LinkAccountPageContent() {
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") || "google";
  const callbackUrl = searchParams.get("callbackUrl") || "/settings";

  useEffect(() => {
    // Initiate OAuth sign-in with account linking
    const linkAccount = async () => {
      sessionStorage.setItem("linkingAccount", "true");
      await signIn(provider, {
        redirect: true,
        callbackUrl: `/auth/link-callback?provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      });
    };

    linkAccount();
  }, [provider, callbackUrl]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

export default function LinkAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <LinkAccountPageContent />
    </Suspense>
  );
}
