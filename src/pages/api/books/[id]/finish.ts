import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

/**
 * The form submits the state it WANTS, never "flip whatever it is now". A flipping form gives
 * a different result depending on how many times it is submitted, so a double tap on a slow
 * connection would finish a book and immediately reopen it. Submitting this twice is
 * idempotent.
 *
 * Route-local on purpose: src/types.ts holds shared entities and DTOs, and nothing else needs
 * this one — there is no client-side mirror because the value comes from a hidden field.
 */
const finishSchema = z.object({
  finished: z.enum(["true", "false"]),
});

export const POST: APIRoute = async (context) => {
  const bookId = context.params.id;
  const toBooks = (message: string) => context.redirect(`/books?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return toBooks("Supabase is not configured");
  }

  const form = await context.request.formData();
  const parsed = finishSchema.safeParse({ finished: form.get("finished") });
  if (!parsed.success) {
    return toBooks("Could not change the book's status");
  }

  // RLS scopes both reads and writes to the reader's own book, so another reader's id is
  // simply not found — no ownership check is duplicated here.
  const { data: book } = await supabase
    .from("books")
    .select("id, finished_at")
    .eq("id", bookId)
    .maybeSingle<{ id: string; finished_at: string | null }>();

  if (!book) {
    return toBooks("Book not found");
  }

  const wantsFinished = parsed.data.finished === "true";
  const alreadyFinished = book.finished_at !== null;

  // Idempotent in the strict sense: re-finishing an already-finished book must not move the
  // date. "Finished on" is the day the reader first finished it, and a double tap on a slow
  // connection should not rewrite that.
  if (wantsFinished === alreadyFinished) {
    return context.redirect(`/books/${bookId}`);
  }

  const { error } = await supabase
    .from("books")
    .update({ finished_at: wantsFinished ? new Date().toISOString() : null })
    .eq("id", bookId);

  if (error) {
    return toBooks(error.message);
  }

  return context.redirect(`/books/${bookId}`);
};
