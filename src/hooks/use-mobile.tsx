import * as React from "react"

/**
 * @fileOverview Custom hook `useIsMobile`.
 * This hook determines if the current viewport width is below a defined mobile breakpoint.
 * It's used throughout the application to render different layouts for mobile vs. desktop,
 * particularly for controlling the sidebar behavior.
 */

// Define the breakpoint for what is considered a "mobile" screen width.
const MOBILE_BREAKPOINT = 768; // Corresponds to Tailwind's `md` breakpoint.

/**
 * A custom React hook that returns true if the window width is less than the mobile breakpoint.
 * It listens for window resize events to update its state.
 *
 * @returns {boolean} `true` if the viewport is considered mobile, otherwise `false`.
 */
export function useIsMobile() {
  // State to store the mobile status. `undefined` initially to handle server-side rendering.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Create a media query list object.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Function to update state based on the current window width.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Add listener for changes in the media query (e.g., window resize, orientation change).
    mql.addEventListener("change", onChange);

    // Set the initial state when the component mounts.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Cleanup function to remove the event listener when the component unmounts.
    return () => mql.removeEventListener("change", onChange);
  }, []); // Empty dependency array means this effect runs only once on mount.

  // Return the boolean value. `!!` converts `undefined` to `false` on initial SSR render.
  return !!isMobile;
}
