import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// A separate route because HTML forms cannot issue DELETE, and a hidden _action field would
// conflate two operations on one endpoint.
export const POST: APIRoute = async (context) => {
  const characterId = context.params.id;

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/books?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // RLS scopes the delete to the reader's own row. Zero rows affected is not an error: it
  // means the row was not theirs, which the policy already handled.
  const { data: deleted, error } = await supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .select("book_id")
    .maybeSingle<{ book_id: string }>();

  if (error) {
    return context.redirect(`/books?error=${encodeURIComponent(error.message)}`);
  }
  if (!deleted) {
    return context.redirect(`/books?error=${encodeURIComponent("Character not found")}`);
  }

  return context.redirect(`/books/${deleted.book_id}`);
};
