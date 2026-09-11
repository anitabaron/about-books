import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

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

  const { data: existing } = await supabase
    .from("relationship_types")
    .select("id, book_id, name")
    .eq("id", typeId)
    .maybeSingle<{ id: string; book_id: string; name: string }>();

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

  // The count is only for the sentence. The foreign key is what actually refuses the delete,
  // so a type in use cannot be removed even if this count is stale by the time we write.
  const { count } = await supabase
    .from("relationships")
    .select("id", { count: "exact", head: true })
    .eq("custom_type_id", typeId);

  // Doubled on purpose: the query counts ROWS, but a connection renders under both of its
  // characters, so a reader looking at the cast counts it twice. The number in the sentence
  // has to be the number they can see, or it reads as a bug. A row can never have both ends
  // on one character (relationships_distinct_characters), so this is always even -- which is
  // why the sentence needs no singular form.
  const inUse = (count ?? 0) * 2;
  if (inUse > 0) {
    return backToBook(`"${existing.name}" is used by ${inUse} connections. Change them first.`);
  }

  const { error } = await supabase.from("relationship_types").delete().eq("id", typeId);

  if (error) {
    // The backstop firing means the count above was stale -- a connection started using this
    // type between the count and the delete. Same sentence, without a number we no longer trust.
    if (error.code === "23503") {
      return backToBook(`"${existing.name}" is now used by a connection. Change it first.`);
    }
    return backToBook(error.message);
  }

  return context.redirect(`/books/${existing.book_id}`);
};
