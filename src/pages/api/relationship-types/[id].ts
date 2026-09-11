import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isPresetSlug } from "@/lib/relationship-type";
import { updateRelationshipTypeSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const typeId = context.params.id;

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/books?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const toBooks = (message: string) => context.redirect(`/books?error=${encodeURIComponent(message)}`);

  // RLS-filtered, so another reader's type is simply not found. Read it first for its book,
  // which is both the redirect target and the proof the row is this reader's.
  const { data: existing } = await supabase
    .from("relationship_types")
    .select("id, book_id")
    .eq("id", typeId)
    .maybeSingle<{ id: string; book_id: string }>();

  if (!existing) {
    return toBooks("Relationship type not found");
  }

  // `at` scopes the message to this section and `for` narrows it to THIS type's record, so the
  // sentence lands beside the button the reader pressed rather than under the whole list. The
  // fragment re-opens the collapsed disclosure and scrolls to that record. Without any of it,
  // every error from this page surfaced in the "Add a character" island at the very top, in a
  // section the reader could no longer see.
  const backToBook = (message: string) =>
    context.redirect(
      `/books/${existing.book_id}?error=${encodeURIComponent(message)}&at=relationship-types&for=${typeId}#relationship-type-${typeId}`,
    );

  const form = await context.request.formData();
  const parsed = updateRelationshipTypeSchema.safeParse({ name: form.get("name") });
  if (!parsed.success) {
    return backToBook(parsed.error.issues[0].message);
  }

  // Same check as the create path: the shared names are rows, so the schema cannot hold them
  // and the sentence has to be produced here.
  if (await isPresetSlug(supabase, parsed.data.name.trim().toLowerCase())) {
    return backToBook("That is already one of the shared types");
  }

  // The whole point of the foreign key: the name lives in one row, so this single update
  // changes what every connection holding this type displays. No connection is touched.
  const { data: updated, error } = await supabase
    .from("relationship_types")
    .update({ name: parsed.data.name })
    .eq("id", typeId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      return backToBook(`You already have a type called "${parsed.data.name}" in this book`);
    }
    if (error.code === "23514") {
      return backToBook("That name cannot be used for a relationship type");
    }
    return backToBook(error.message);
  }
  // Zero rows means the row was not this reader's; RLS already handled it.
  if (!updated) {
    return backToBook("Relationship type not found");
  }

  return context.redirect(`/books/${existing.book_id}`);
};
