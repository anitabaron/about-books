import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  addConnection,
  connectionErrorUrl,
  readConnectionEdits,
  readPendingConnection,
  updateConnection,
  type StoredConnection,
} from "@/lib/services/connection";
import { updateCharacterSchema } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const characterId = context.params.id;
  const backToBooks = (message: string) => context.redirect(`/books?error=${encodeURIComponent(message)}`);

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToBooks("Supabase is not configured");
  }

  const form = await context.request.formData();
  const parsed = updateCharacterSchema.safeParse({
    name: form.get("name"),
    description: form.get("description"),
  });

  // The Link row submits with Save too, so a connection the reader picked but did not press Add
  // for is not silently dropped. Read before any write: a half-picked link refuses the whole
  // Save, rather than saving the name and leaving the reader to notice the link is missing.
  const pending = readPendingConnection(form.get("type"), form.get("other_character_id"));

  // Without a valid parse there is no trustworthy row to redirect to, so fall back to the
  // collection rather than echoing a client-supplied book id into the URL.
  const formBookId = form.get("book_id");
  const hasFormBookId = typeof formBookId === "string" && formBookId !== "";

  if (!parsed.success) {
    const message = parsed.error.issues[0].message;
    return hasFormBookId
      ? context.redirect(`/books/${formBookId}?error=${encodeURIComponent(message)}`)
      : backToBooks(message);
  }

  if (pending.kind === "invalid") {
    return hasFormBookId && characterId
      ? context.redirect(connectionErrorUrl(formBookId, characterId, pending.message))
      : backToBooks(pending.message);
  }

  // The "Change or remove" rows submit with Save as well, for the same reason as the Link row:
  // a type changed in a select and never ticked used to be lost on Save. Compared against the
  // stored rows (RLS-filtered, and only this character's own end), so only what the reader
  // actually changed is written.
  const { data: stored, error: storedError } = await supabase
    .from("relationships")
    .select("id, character_b_id, type, custom_type_id")
    .eq("character_a_id", characterId ?? "")
    .overrideTypes<StoredConnection[], { merge: false }>();

  if (storedError) {
    return backToBooks(storedError.message);
  }

  const connectionEdits = readConnectionEdits((name) => form.get(name), stored);
  if (connectionEdits.kind === "invalid") {
    return hasFormBookId && characterId
      ? context.redirect(connectionErrorUrl(formBookId, characterId, connectionEdits.message))
      : backToBooks(connectionEdits.message);
  }

  // RLS restricts the update to the reader's own row, so no ownership check is duplicated
  // here. Returning book_id makes the redirect authoritative instead of trusting the form.
  const { data: updated, error } = await supabase
    .from("characters")
    .update(parsed.data)
    .eq("id", characterId)
    .select("book_id")
    .maybeSingle<{ book_id: string }>();

  if (error) {
    return backToBooks(error.message);
  }
  if (!updated) {
    return backToBooks("Character not found");
  }

  // After the update, so the book_id is the row's, not the form's. If one of these fails the
  // name and note are already saved, and so is any connection written before it; the message
  // names only the connection that was refused, which is true. Edits first, then the new link:
  // an edit can free a pair the new link is about to take.
  if (characterId) {
    const anchor = { id: characterId, book_id: updated.book_id };

    for (const edit of connectionEdits.edits) {
      const failure = await updateConnection(supabase, anchor, edit.id, edit.command);
      if (failure) {
        return context.redirect(connectionErrorUrl(updated.book_id, characterId, failure));
      }
    }

    if (pending.kind === "ok") {
      const failure = await addConnection(supabase, anchor, pending.command);
      if (failure) {
        return context.redirect(connectionErrorUrl(updated.book_id, characterId, failure));
      }
    }
  }

  return context.redirect(`/books/${updated.book_id}`);
};
