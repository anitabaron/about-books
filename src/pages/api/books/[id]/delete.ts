import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// A separate route because HTML forms cannot issue DELETE, and a hidden _action field would
// conflate two operations on one endpoint.
//
// This is the first operation that fires the whole cascade at once: books -> characters ->
// relationships, and books -> relationship_types, whose ids relationships.custom_type_id
// references. That foreign key is NO ACTION rather than RESTRICT precisely so the check runs
// at end of statement, when the characters cascade has already removed the referencing rows,
// instead of failing on whichever branch happens to fire first. Until this route existed the
// path was unreachable; `supabase/tests/rls_books.sql` asserts it.
export const POST: APIRoute = async (context) => {
  const bookId = context.params.id;

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
    .from("books")
    .delete()
    .eq("id", bookId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return context.redirect(`/books?error=${encodeURIComponent(error.message)}`);
  }
  if (!deleted) {
    return context.redirect(`/books?error=${encodeURIComponent("Book not found")}`);
  }

  // Back to the collection, never to the book: it no longer exists.
  return context.redirect("/books");
};
