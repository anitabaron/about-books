import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createCharacterSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const bookId = context.params.id;
  const backToBook = (message: string) => context.redirect(`/books/${bookId}?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/books?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // This read is RLS-filtered, so another reader's book simply is not found. That is what
  // stops a hand-crafted post from attaching a character to a book the poster does not own:
  // the policies only check auth.uid() = user_id, not the book relation.
  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) {
    return context.redirect(`/books?error=${encodeURIComponent("Book not found")}`);
  }

  const form = await context.request.formData();
  const parsed = createCharacterSchema.safeParse({
    name: form.get("name"),
    description: form.get("description"),
  });

  if (!parsed.success) {
    return backToBook(parsed.error.issues[0].message);
  }

  // No user_id: the column defaults to auth.uid() and the insert policy rejects a forged one.
  const { error } = await supabase.from("characters").insert({ ...parsed.data, book_id: bookId });
  if (error) {
    return backToBook(error.message);
  }

  return context.redirect(`/books/${bookId}`);
};
