import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { connectionErrorUrl, connectionFields, updateConnection } from "@/lib/services/connection";
import { updateRelationshipSchema } from "@/types";

export const prerender = false;

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
  if (!relationshipId) {
    return toBooks("Relationship not found");
  }

  // The row's tick submits the whole character form (via formAction), so this connection's
  // fields are named after it -- see connectionFields.
  const form = await context.request.formData();
  const fields = connectionFields(relationshipId);
  const parsed = updateRelationshipSchema.safeParse({
    anchor_id: form.get("anchor_id"),
    other_character_id: form.get(fields.other),
    type: form.get(fields.type),
  });
  if (!parsed.success) {
    return toBooks(parsed.error.issues[0].message);
  }
  const { anchor_id, ...command } = parsed.data;

  // RLS-filtered, so another reader's character is simply not found.
  const { data: anchor } = await supabase
    .from("characters")
    .select("id, book_id")
    .eq("id", anchor_id)
    .maybeSingle<{ id: string; book_id: string }>();

  if (!anchor) {
    return toBooks("Character not found");
  }

  const failure = await updateConnection(supabase, anchor, relationshipId, command);
  if (failure) {
    return context.redirect(connectionErrorUrl(anchor.book_id, anchor.id, failure));
  }

  return context.redirect(`/books/${anchor.book_id}`);
};
