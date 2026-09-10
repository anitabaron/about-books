import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateRelationshipSchema } from "@/types";

export const prerender = false;

interface RelationshipEnds {
  character_a_id: string;
  character_b_id: string;
}

export const POST: APIRoute = async (context) => {
  const relationshipId = context.params.id;
  const toBooks = (message: string) => context.redirect(`/books?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return toBooks("Supabase is not configured");
  }

  const form = await context.request.formData();
  const parsed = updateRelationshipSchema.safeParse({
    anchor_id: form.get("anchor_id"),
    other_character_id: form.get("other_character_id"),
    type: form.get("type"),
  });
  if (!parsed.success) {
    return toBooks(parsed.error.issues[0].message);
  }
  const { anchor_id, other_character_id, type } = parsed.data;

  // Both reads are RLS-filtered. Requiring a shared book_id is what keeps a relationship
  // from straddling two books; the policies only check auth.uid() = user_id.
  const { data: pair } = await supabase
    .from("characters")
    .select("id, book_id")
    .in("id", [anchor_id, other_character_id])
    .overrideTypes<{ id: string; book_id: string }[], { merge: false }>();

  const anchor = pair?.find((c) => c.id === anchor_id);
  if (!anchor) {
    return toBooks("Character not found");
  }

  const backToBook = (message: string) =>
    context.redirect(`/books/${anchor.book_id}?error=${encodeURIComponent(message)}`);

  if (anchor_id === other_character_id) {
    return backToBook("A character cannot be related to itself");
  }

  const other = pair?.find((c) => c.id === other_character_id);
  if (other?.book_id !== anchor.book_id) {
    return backToBook("That character is not in this book");
  }

  // The anchor can sit in EITHER column: which one depends only on whose row the
  // relationship was created from. Read the row and write the replacement into the opposite
  // end. Assuming the anchor is always character_a_id silently rewrites the wrong side.
  const { data: existing } = await supabase
    .from("relationships")
    .select("character_a_id, character_b_id")
    .eq("id", relationshipId)
    .maybeSingle<RelationshipEnds>();

  if (!existing) {
    return backToBook("Relationship not found");
  }

  const anchorIsA = existing.character_a_id === anchor_id;
  const anchorIsB = existing.character_b_id === anchor_id;
  if (!anchorIsA && !anchorIsB) {
    return backToBook("That character is not part of this relationship");
  }

  const patch = anchorIsA ? { character_b_id: other_character_id, type } : { character_a_id: other_character_id, type };

  const { data: updated, error } = await supabase
    .from("relationships")
    .update(patch)
    .eq("id", relationshipId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return backToBook(error.message);
  }
  // Zero rows means the row was not this reader's; RLS already handled it.
  if (!updated) {
    return backToBook("Relationship not found");
  }

  return context.redirect(`/books/${anchor.book_id}`);
};
