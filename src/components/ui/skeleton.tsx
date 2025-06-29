import { cn } from "@/lib/utils"

/**
 * @fileoverview Skeleton component.
 * This file contains the skeleton component.
 * It is used to display a placeholder preview of a component's content while the data is loading.
 */

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
