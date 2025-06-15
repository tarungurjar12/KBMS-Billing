// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // For displaying notifications
import { Inter } from 'next/font/google'; // Import Inter font
import ClientOnly from '@/components/client-only'; // Import the ClientOnly component

/**
 * @fileOverview Root layout for the entire application.
 * Sets up global styles, fonts, metadata, and the Toaster component for notifications.
 */

// Initialize Inter font with subsets
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Use swap for better font loading performance
  variable: '--font-inter', // This defines the CSS variable name for Tailwind
});

/**
 * Metadata for the application.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/metadata
 */
export const metadata: Metadata = {
  title: 'KBMS Billing',
  description: 'KBMS Billing Application for Building Material Supply Business by Nikhil Dedha.',
  // Future: Add more metadata like openGraph, icons, etc.
};

/**
 * Viewport configuration for responsiveness.
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Optional: prevent zooming if desired
};

/**
 * RootLayout component.
 * This is the main layout wrapper for all pages in the application.
 * It applies global styles, fonts, and the Toaster component.
 * Children are wrapped in ClientOnly to help bypass hydration errors.
 * @param {Readonly<{ children: React.ReactNode }>} props - The props for the component.
 * @param {React.ReactNode} props.children - The child React nodes to render within the layout.
 * @returns {JSX.Element} The rendered root layout.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Metadata and other head elements are injected by Next.js */}
      </head>
      <body className={`antialiased bg-background text-foreground ${inter.className}`}>
        <ClientOnly>
          {children}
        </ClientOnly>
        <Toaster /> {/* Toaster for displaying notifications globally */}
      </body>
    </html>
  );
}
