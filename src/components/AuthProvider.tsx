"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/** Wraps the app in NextAuth's SessionProvider for useSession() access */
export default function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
