import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/* One field treatment product-wide: a writable line, never a box. What changes
 * between capture and the inspector is DENSITY, not the shape — here the target
 * is 44px and the type is 16px, because the reader is mid-chapter and the 16px
 * floor is what stops iOS zooming the viewport on focus. */
const inputBase =
  "w-full min-h-11 rounded-none border-0 border-b bg-transparent py-2 pr-2 pl-7 font-[family-name:var(--font-serif)] text-base text-ink transition-colors outline-none placeholder:text-muted-fg";

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
        <span className="text-muted-fg pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2">
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
          className={cn(inputBase, error ? "border-b-signal" : "border-b-rule-strong focus-visible:border-b-focus")}
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
