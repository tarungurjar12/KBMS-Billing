
// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // For displaying notifications
import { Inter } from 'next/font/google'; // Import Inter font
import ClientOnly from '@/components/client-only'; 

/**
 * @fileOverview Root layout for the entire application.
 * This file sets up global styles, fonts, metadata, and the Toaster component,
 * which is used for displaying notifications (toasts) throughout the app.
 * It also wraps the main content in a ClientOnly component to help prevent
 * hydration errors that can occur with server-side rendering in Next.js.
 */

// Initialize Inter font with specified subsets for optimization.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Use 'swap' for better font loading performance, preventing text from being invisible.
  variable: '--font-inter', // This defines a CSS variable name that can be used in Tailwind CSS configuration.
});

/**
 * Metadata for the application, used for SEO and browser tab information.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/metadata
 */
export const metadata: Metadata = {
  title: 'KBMS Billing',
  description: 'KBMS Billing Application for Building Material Supply Business by Nikhil Dedha.',
};

/**
 * Viewport configuration to ensure responsiveness across devices.
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, 
};

/**
 * RootLayout component.
 * This is the main layout wrapper for all pages in the application.
 * It applies global styles, fonts, and includes the Toaster component for notifications.
 *
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
        {/* Metadata and other head elements are injected by Next.js automatically */}
      </head>
      {/* The `inter.variable` class applies the Inter font via CSS variable defined in globals.css */}
      <body className={`antialiased bg-background text-foreground`}> 
        {/*
          Using ClientOnly can help bypass hydration errors that occur when the server-rendered HTML
          doesn't match the initial client-rendered HTML. This is useful for complex layouts or
          components that rely on client-side state or browser APIs.
        */}
        <ClientOnly>
          {children}
        </ClientOnly>
        
        {/* Toaster for displaying notifications (toasts) globally across the application */}
        <Toaster /> 
      </body>
    </html>
  );
}
