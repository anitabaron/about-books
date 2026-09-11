import React, { useState } from "react";
import { PenLine, User, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  bookId: string;
  serverError?: string | null;
}

// Mirrors createCharacterSchema in src/types.ts, kept in step by hand. The server
// re-validates every submission, so drift here costs a worse message, never the guarantee.
const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

export default function AddCharacterForm({ bookId, serverError }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  // US-02: a character must be creatable from a NAME ALONE. Only the name is validated
  // here — nothing else may block submission, or the story fails however well the rest works.
  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = "Name is required";
    } else if (name.trim().length > NAME_MAX) {
      next.name = "Name is too long";
    }
    if (description.trim().length > DESCRIPTION_MAX) {
      next.description = "Description is too long";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form
      method="POST"
      action={`/api/books/${bookId}/characters`}
      className="flex flex-col gap-1.5"
      onSubmit={handleSubmit}
      noValidate
    >
      <FormField
        dense
        id="name"
        label="Name"
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="Paul Atreides"
        error={errors.name}
        icon={<User className="size-4" />}
      />

      <FormField
        dense
        id="description"
        label="Note"
        value={description}
        onChange={(v) => {
          setDescription(v);
          clearError("description");
        }}
        placeholder="Who they are, how you met them"
        error={errors.description}
        icon={<PenLine className="size-4" />}
        hint={<p className="text-muted-fg mt-0.5 text-[0.78rem]">Optional. Fill this in as you read.</p>}
      />

      <ServerError message={serverError} />

      <SubmitButton size="default" full={false} pendingText="Adding..." icon={<UserPlus className="size-4" />}>
        Add character
      </SubmitButton>
    </form>
  );
}
