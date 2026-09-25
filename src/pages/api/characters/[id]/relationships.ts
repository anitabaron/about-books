import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { addConnection, connectionErrorUrl } from "@/lib/services/connection";
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

  // RLS-filtered, so another reader's character is simply not found.
  const { data: anchor } = await supabase
    .from("characters")
    .select("id, book_id")
    .eq("id", anchorId)
    .maybeSingle<{ id: string; book_id: string }>();

  if (!anchor) {
    return context.redirect(`/books?error=${encodeURIComponent("Character not found")}`);
  }

  if (!parsed.success) {
    return context.redirect(connectionErrorUrl(anchor.book_id, anchor.id, parsed.error.issues[0].message));
  }

  const failure = await addConnection(supabase, anchor, parsed.data);
  if (failure) {
    return context.redirect(connectionErrorUrl(anchor.book_id, anchor.id, failure));
  }

  return context.redirect(`/books/${anchor.book_id}`);
};
