"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ToastContainer position="top-right" theme="colored" />
    </SessionProvider>
  );
}
