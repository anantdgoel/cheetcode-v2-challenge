"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

let convexClient: ConvexReactClient | null = null;

function getConvexClient() {
  if (convexClient) {
    return convexClient;
  }

  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!deploymentUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }

  convexClient = new ConvexReactClient(deploymentUrl);
  return convexClient;
}

export function ConvexPublicProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProvider client={getConvexClient()}>{children}</ConvexProvider>;
}
