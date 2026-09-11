import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* A button here is a stamped block, not a pill: square corners, mono uppercase
 * label, one hairline boundary. `destructive` shares the accent hue with links
 * and relationship types, so it always carries an explicit verb — the colour is
 * never the only signal, and every destructive action additionally sits behind
 * a nested <details> confirmation in the markup that uses it. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border font-[family-name:var(--font-label)] text-[length:var(--text-label)] font-semibold tracking-[0.1em] uppercase transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease-out)] outline-none select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-paper hover:bg-ink-2",
        destructive: "border-signal bg-transparent text-signal hover:bg-paper-3",
        outline: "border-ink bg-transparent text-ink hover:bg-paper-3",
        secondary: "border-rule bg-paper-2 text-ink hover:bg-paper-3",
        ghost: "border-transparent bg-transparent text-ink-2 hover:bg-paper-3 hover:text-ink",
        link: "border-transparent bg-transparent text-signal underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        // Touch heights match the 36px field they sit under, so a form reads as
        // one block rather than as controls of three different weights. WCAG 2.2
        // AA asks 24px; 44px is AAA/HIG and was making every submit the loudest
        // thing on a working screen. `lg` keeps the taller target for auth,
        // where the button IS the page.
        default: "min-h-8 px-3 pointer-coarse:min-h-9",
        sm: "min-h-7 px-2 pointer-coarse:min-h-8",
        lg: "min-h-10 px-4 pointer-coarse:min-h-11",
        icon: "size-8 px-0 pointer-coarse:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
