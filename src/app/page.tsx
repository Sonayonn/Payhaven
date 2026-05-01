"use client";

import { usePrivy } from "@privy-io/react-auth";
import { LandingPage } from "@/components/landing/LandingPage";
import { Dashboard } from "@/components/Dashboard";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

/**
 * Smart router for the root page.
 */
export default function Home() {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return <DashboardSkeleton />;
  }

  if (authenticated) {
    return <Dashboard />;
  }

  return <LandingPage />;
}