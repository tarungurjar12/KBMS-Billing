// src/components/client-only.tsx
"use client";

import { useState, useEffect, type ReactNode } from 'react';

/**
 * @fileOverview ClientOnly component.
 * This utility component ensures that its children are only rendered on the client-side
 * after the component has mounted. This is a common pattern in Next.js to prevent
 * hydration errors, which occur when the server-rendered HTML doesn't match the
 * initial client-rendered HTML.
 */

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode; // Optional fallback to show during SSR or before client mount
}

/**
 * Renders its children only after the component has successfully mounted on the client.
 * This is useful for components that depend on browser-specific APIs (like `window` or `localStorage`)
 * or to avoid hydration mismatches for components with complex client-side logic.
 *
 * @param {ClientOnlyProps} props - The props for the component.
 * @param {ReactNode} props.children - The content to be rendered only on the client.
 * @param {ReactNode} [props.fallback=null] - Optional content to render on the server and before client mount.
 * @returns {JSX.Element | null} The children if mounted, otherwise the fallback or null.
 */
export default function ClientOnly({ children, fallback = null }: ClientOnlyProps): JSX.Element | null {
  // State to track whether the component has mounted on the client
  const [hasMounted, setHasMounted] = useState(false);

  // useEffect runs only on the client-side, after the initial render.
  useEffect(() => {
    // Set hasMounted to true, which will trigger a re-render.
    setHasMounted(true);
  }, []);

  // If the component has not yet mounted, render the fallback (or null).
  // This is what will be rendered on the server and during the initial client render.
  if (!hasMounted) {
    return fallback as JSX.Element | null;
  }

  // Once mounted, render the actual children.
  return <>{children}</>;
}
