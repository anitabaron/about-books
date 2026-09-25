import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  /** "lg" full-width is right where the form is the whole screen (auth). On a
   *  working screen the same weight makes a one-line action look like the page's
   *  main event. */
  size?: "default" | "lg";
  full?: boolean;
}

/* The pending state is not React state. These forms post to a URL, and useFormStatus -- which
 * this used to read -- only tracks React form actions, so it never reported pending and the
 * spinner below it never rendered. The shared submit script in Layout.astro sets aria-busy on
 * the button and swaps the `[data-label]` text for `data-pending-text`; button.tsx draws the
 * spinner in place of the icon. */
export function SubmitButton({ pendingText, icon, children, size = "lg", full = true }: SubmitButtonProps) {
  return (
    <Button type="submit" size={size} data-pending-text={pendingText} className={full ? "w-full" : undefined}>
      {icon}
      <span data-label>{children}</span>
    </Button>
  );
}
