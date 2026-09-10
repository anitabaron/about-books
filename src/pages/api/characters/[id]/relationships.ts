import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createRelationshipSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const anchorId = context.params.id;

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/books?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const form = await context.request.formData();
  const parsed = createRelationshipSchema.safeParse({
    other_character_id: form.get("other_character_id"),
    type: form.get("type"),
  });

  // Both reads are RLS-filtered, so another reader's character is simply not found. Requiring
  // a shared book_id is what stops a hand-crafted post from relating characters across two
  // books: the policies only check auth.uid() = user_id, not the relation.
  const { data: pair } = await supabase
    .from("characters")
    .select("id, book_id")
    .in("id", parsed.success ? [anchorId, parsed.data.other_character_id] : [anchorId])
    .overrideTypes<{ id: string; book_id: string }[], { merge: false }>();

  const anchor = pair?.find((c) => c.id === anchorId);
  if (!anchor) {
    return context.redirect(`/books?error=${encodeURIComponent("Character not found")}`);
  }

  const backToBook = (message: string) =>
    context.redirect(`/books/${anchor.book_id}?error=${encodeURIComponent(message)}`);

  if (!parsed.success) {
    return backToBook(parsed.error.issues[0].message);
  }

  const other = pair?.find((c) => c.id === parsed.data.other_character_id);
  if (other?.book_id !== anchor.book_id) {
    return backToBook("That character is not in this book");
  }

  // No user_id: the column defaults to auth.uid() and the insert policy rejects a forged one.
  const { error } = await supabase.from("relationships").insert({
    character_a_id: anchorId,
    character_b_id: parsed.data.other_character_id,
    type: parsed.data.type,
  });

  if (error) {
    return backToBook(error.message);
  }

  return context.redirect(`/books/${anchor.book_id}`);
};
