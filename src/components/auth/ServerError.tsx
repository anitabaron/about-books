import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="border-signal text-signal flex items-start gap-2 border-l-[3px] py-1 pl-3 font-[family-name:var(--font-serif)] text-[0.9rem]"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}
