import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createBookSchema } from "@/types";

export const prerender = false;

const BOOKS_PATH = "/books";

export const POST: APIRoute = async (context) => {
  const backWithError = (message: string) => context.redirect(`${BOOKS_PATH}?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backWithError("Supabase is not configured");
  }

  const form = await context.request.formData();
  // A cleared text input arrives as "", which createBookSchema maps to null for `author`.
  const parsed = createBookSchema.safeParse({
    title: form.get("title"),
    author: form.get("author"),
  });

  if (!parsed.success) {
    return backWithError(parsed.error.issues[0].message);
  }

  // Insert the parsed object verbatim: `user_id` is filled by `default auth.uid()` in the
  // database, and the insert policy would reject a client-supplied owner id anyway.
  const { error } = await supabase.from("books").insert(parsed.data);
  if (error) {
    return backWithError(error.message);
  }

  return context.redirect(BOOKS_PATH);
};
