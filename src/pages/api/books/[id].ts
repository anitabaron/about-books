import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateBookSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const bookId = context.params.id;
  const backToBooks = (message: string) => context.redirect(`/books?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToBooks("Supabase is not configured");
  }

  const form = await context.request.formData();
  // updateBookSchema has existed unused since M-1, written when adding a book shipped without
  // editing one. It already carries the length caps and the "provide at least one field" rule.
  // `form.get()` answers null for a field that was not submitted, but `.optional()` accepts
  // undefined -- so passing null straight through failed the string check before the schema's
  // "provide at least one field" refinement could run, and the reader saw Zod's internal
  // "expected string, received null" instead of a sentence.
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : undefined;
  };

  const parsed = updateBookSchema.safeParse({
    title: field("title"),
    author: field("author"),
  });

  const backToBook = (message: string) =>
    context.redirect(`/books/${bookId}?error=${encodeURIComponent(message)}&at=book`);

  if (!parsed.success) {
    return backToBook(parsed.error.issues[0].message);
  }

  // RLS restricts the update to the reader's own row, so no ownership check is duplicated
  // here. Selecting the id back makes zero-rows distinguishable from a database error.
  const { data: updated, error } = await supabase
    .from("books")
    .update(parsed.data)
    .eq("id", bookId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return backToBook(error.message);
  }
  // Zero rows means the row was not this reader's; RLS already handled it.
  if (!updated) {
    return backToBooks("Book not found");
  }

  return context.redirect(`/books/${bookId}`);
};
