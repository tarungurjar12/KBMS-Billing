
import * as React from 'react';

import {cn} from '@/lib/utils';

/**
 * @fileoverview Textarea component.
 * This file contains the textarea component.
 * It is used to get user input in a multi-line text field.
 */

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
        value={props.value ?? ""}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
