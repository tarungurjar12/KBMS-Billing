import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter } from 'next/font/google';

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

export const metadata: Metadata = {
  title: 'KBMS Billing',
  description: 'KBMS Billing Application for Building Material Supply Business by Nikhil Dedha.',
  // Future: Add more metadata like openGraph, icons, etc.
};

// Add viewport configuration for responsiveness
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Optional: prevent zooming if desired
};

/**
 * RootLayout component.
 * @param children - The child React nodes to render within the layout.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Metadata and other head elements are injected by Next.js */}
      </head>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        {children}
        <Toaster /> {/* Toaster for displaying notifications globally */}
      </body>
    </html>
  );
}
