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
        {/* Google Fonts Preconnect - Handled by Inter from next/font */}
        {/* <link rel="preconnect" href="https://fonts.googleapis.com" /> */}
        {/* <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /> */}
        {/* <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" /> */}
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
