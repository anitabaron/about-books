import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// A separate route because HTML forms cannot issue DELETE, and a hidden _action field would
// conflate two operations on one endpoint.
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

  // Delete under RLS and take one end back, so the redirect target is derived from the
  // database rather than from a form field. Zero rows is not an error: it means the row was
  // not this reader's, which the policy already handled.
  const { data: deleted, error } = await supabase
    .from("relationships")
    .delete()
    .eq("id", relationshipId)
    .select("character_a_id")
    .maybeSingle<{ character_a_id: string }>();

  if (error) {
    return toBooks(error.message);
  }
  if (!deleted) {
    return toBooks("Relationship not found");
  }

  const { data: character } = await supabase
    .from("characters")
    .select("book_id")
    .eq("id", deleted.character_a_id)
    .maybeSingle<{ book_id: string }>();

  return character ? context.redirect(`/books/${character.book_id}`) : context.redirect("/books");
};
