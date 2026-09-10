import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/* Capture density: the reader is mid-chapter and US-02 wants a character in
 * under 30 seconds. Full box, 44px, 16px type — the 16px floor is what stops
 * iOS zooming the viewport on focus. */
const inputBase =
  "w-full min-h-11 rounded-none border bg-paper py-2 pr-3 pl-9 font-[family-name:var(--font-serif)] text-base text-ink transition-colors outline-none placeholder:text-muted-fg";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1 block">
        {label}
      </label>
      <div className="relative">
        <span className="text-muted-fg pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2">
          {icon}
        </span>
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(inputBase, error ? "border-signal" : "border-rule-strong focus-visible:border-focus")}
        />
        {endContent}
      </div>
      {/* Never colour alone: the border changes AND a sentence appears. */}
      {error ? (
        <p id={`${id}-error`} className="text-signal mt-1 flex items-center gap-1 text-[0.833rem]">
          <CircleAlert className="size-3 shrink-0" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
