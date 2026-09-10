import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createRelationshipTypeSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const bookId = context.params.id;

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/books?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // `at` scopes the message so the page renders it where the reader was working, and the
  // fragment re-opens the collapsed disclosure and scrolls to it. Without both, every error
  // from this page surfaces in the "Add a character" island at the very top, in a section the
  // reader can no longer see.
  const backToBook = (message: string) =>
    context.redirect(
      `/books/${bookId}?error=${encodeURIComponent(message)}&at=relationship-types#relationship-types-add`,
    );

  const form = await context.request.formData();
  const parsed = createRelationshipTypeSchema.safeParse({ name: form.get("name") });
  if (!parsed.success) {
    return backToBook(parsed.error.issues[0].message);
  }

  // RLS-filtered, so another reader's book is simply not found. Checking it here is what
  // turns a policy denial into a sentence instead of a raw insert error.
  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle<{ id: string }>();

  if (!book) {
    return context.redirect(`/books?error=${encodeURIComponent("Book not found")}`);
  }

  // No user_id: the column defaults to auth.uid() and the insert policy rejects a forged one.
  const { error } = await supabase.from("relationship_types").insert({ book_id: bookId, name: parsed.data.name });

  if (error) {
    // The unique index is per (book, lower(btrim(name))), so this is always a name the reader
    // already has in THIS book -- the same name under another book is allowed.
    if (error.code === "23505") {
      return backToBook(`You already have a type called "${parsed.data.name}" in this book`);
    }
    // Zod rejects the five shared names before we get here, so a check violation means the
    // name failed the length bound the schema also enforces.
    if (error.code === "23514") {
      return backToBook("That name cannot be used for a relationship type");
    }
    return backToBook(error.message);
  }

  return context.redirect(`/books/${bookId}`);
};
