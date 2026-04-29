"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes' ThemeProvider with Payhaven defaults.
 *
 * - attribute="class", adds .dark to <html> when in dark mode (matches our globals.css)
 * - defaultTheme="system", respects user's OS preference until they manually toggle
 * - enableSystem, re-syncs with OS when set to "system"
 * - disableTransitionOnChange, prevents the brief color-flash when toggling themes
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}