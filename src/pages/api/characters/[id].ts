import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateCharacterSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const characterId = context.params.id;
  const backToBooks = (message: string) => context.redirect(`/books?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToBooks("Supabase is not configured");
  }

  const form = await context.request.formData();
  const parsed = updateCharacterSchema.safeParse({
    name: form.get("name"),
    description: form.get("description"),
  });

  // Without a valid parse there is no trustworthy row to redirect to, so fall back to the
  // collection rather than echoing a client-supplied book id into the URL.
  if (!parsed.success) {
    const bookId = form.get("book_id");
    const message = parsed.error.issues[0].message;
    return typeof bookId === "string" && bookId !== ""
      ? context.redirect(`/books/${bookId}?error=${encodeURIComponent(message)}`)
      : backToBooks(message);
  }

  // RLS restricts the update to the reader's own row, so no ownership check is duplicated
  // here. Returning book_id makes the redirect authoritative instead of trusting the form.
  const { data: updated, error } = await supabase
    .from("characters")
    .update(parsed.data)
    .eq("id", characterId)
    .select("book_id")
    .maybeSingle<{ book_id: string }>();

  if (error) {
    return backToBooks(error.message);
  }
  if (!updated) {
    return backToBooks("Character not found");
  }

  return context.redirect(`/books/${updated.book_id}`);
};
