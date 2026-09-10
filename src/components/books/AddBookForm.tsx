import React, { useState } from "react";
import { BookPlus, PenLine, User } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

// These mirror createBookSchema in src/types.ts and are kept in step by hand. The server
// re-validates every submission, so drift here costs a worse error message, never the
// guarantee. Update both together.
const TITLE_MAX = 300;
const AUTHOR_MAX = 200;

export default function AddBookForm({ serverError }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [errors, setErrors] = useState<{ title?: string; author?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!title.trim()) {
      next.title = "Title is required";
    } else if (title.trim().length > TITLE_MAX) {
      next.title = "Title is too long";
    }
    if (author.trim().length > AUTHOR_MAX) {
      next.author = "Author name is too long";
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
    <form method="POST" action="/api/books" className="flex flex-col gap-3 px-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="title"
        label="Title"
        value={title}
        onChange={(v) => {
          setTitle(v);
          clearError("title");
        }}
        placeholder="Dune"
        error={errors.title}
        icon={<PenLine className="size-4" />}
      />

      <FormField
        id="author"
        label="Author"
        value={author}
        onChange={(v) => {
          setAuthor(v);
          clearError("author");
        }}
        placeholder="Frank Herbert"
        error={errors.author}
        icon={<User className="size-4" />}
        hint={<p className="text-muted-fg mt-1 text-[0.833rem]">Optional — leave blank if you don&apos;t know it.</p>}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Adding..." icon={<BookPlus className="size-4" />}>
        Add book
      </SubmitButton>
    </form>
  );
}
