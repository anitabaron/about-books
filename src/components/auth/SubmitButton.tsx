import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
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

export function SubmitButton({ pendingText, icon, children, size = "lg", full = true }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size={size} disabled={pending} aria-busy={pending} className={full ? "w-full" : undefined}>
      {pending ? (
        <>
          {/* motion-reduce:animate-none — a spinner is spatial motion like any other. */}
          <span className="border-paper/30 border-t-paper size-3.5 animate-spin border-2 motion-reduce:animate-none" />
          {pendingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}
