// src/components/client-only.tsx
"use client";

import { useState, useEffect, type ReactNode } from 'react';

/**
 * @fileOverview ClientOnly component.
 * This component ensures that its children are only rendered on the client-side
 * after the component has mounted. This can help bypass hydration errors.
 */

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode; // Optional fallback to show during SSR or before client mount
}

/**
 * ClientOnly component.
 * Renders its children only after the component has successfully mounted on the client.
 * This is useful for components that depend on browser-specific APIs or to avoid
 * hydration mismatches for complex client-side logic.
 *
 * @param {ClientOnlyProps} props - The props for the component.
 * @param {ReactNode} props.children - The content to be rendered only on the client.
 * @param {ReactNode} [props.fallback=null] - Optional content to render on the server and before client mount.
 * @returns {JSX.Element | null} The children if mounted, otherwise the fallback or null.
 */
export default function ClientOnly({ children, fallback = null }: ClientOnlyProps): JSX.Element | null {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback as JSX.Element | null;
  }

  return <>{children}</>;
}
