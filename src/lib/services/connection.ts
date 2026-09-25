import type { createClient } from "@/lib/supabase";
import { DUPLICATE_PAIR, duplicateConnectionMessage, resolveTypeColumns } from "@/lib/relationship-type";
import { createRelationshipSchema, type CreateRelationshipCommand } from "@/types";

type Supabase = NonNullable<ReturnType<typeof createClient>>;

/** What the Link row of a character form holds when the form is submitted. */
export type PendingConnection =
  | { kind: "none" }
  | { kind: "invalid"; message: string }
  | { kind: "ok"; command: CreateRelationshipCommand };

/**
 * Read the Link row that rides along with the character's Save. Pure, so it is testable.
 *
 * Save used to ignore that row: a reader who picked a type and a person and then pressed Save
 * instead of Add lost the connection without a word. Now both empty means "no connection",
 * both picked means "add it", and one without the other is refused with a sentence -- guessing
 * the missing half would record a connection the reader never chose.
 */
export function readPendingConnection(
  type: FormDataEntryValue | null,
  other: FormDataEntryValue | null,
): PendingConnection {
  const typeValue = typeof type === "string" ? type : "";
  const otherValue = typeof other === "string" ? other : "";

  if (typeValue === "" && otherValue === "") return { kind: "none" };

  const parsed = createRelationshipSchema.safeParse({ type: typeValue, other_character_id: otherValue });
  return parsed.success
    ? { kind: "ok", command: parsed.data }
    : { kind: "invalid", message: parsed.error.issues[0].message };
}

/**
 * Record a connection from `anchor` to the character the command names. Shared by Add and by
 * the character's Save, which is why the checks live here rather than in either endpoint.
 * Returns the sentence to show the reader, or null on success.
 *
 * RLS makes another reader's character indistinguishable from a missing one; requiring a
 * shared book_id is what stops a hand-crafted post relating characters across two books,
 * because the policies only check auth.uid() = user_id, not the relation.
 */
export async function addConnection(
  supabase: Supabase,
  anchor: { id: string; book_id: string },
  command: CreateRelationshipCommand,
): Promise<string | null> {
  const { data: other } = await supabase
    .from("characters")
    .select("id, book_id, name")
    .eq("id", command.other_character_id)
    .maybeSingle<{ id: string; book_id: string; name: string }>();

  if (other?.book_id !== anchor.book_id) {
    return "That character is not in this book";
  }

  // The select submits ONE field with two possible meanings: a shared literal or a custom
  // type's uuid. Resolve it to exactly one column -- the table's check constraint requires
  // exactly one of the two to be set.
  const typeColumns = await resolveTypeColumns(supabase, command.type, anchor.book_id);
  if (typeColumns === null) {
    return "That relationship type does not exist";
  }

  // No user_id: the column defaults to auth.uid() and the insert policy rejects a forged one.
  const { error } = await supabase.from("relationships").insert({
    character_a_id: anchor.id,
    character_b_id: command.other_character_id,
    ...typeColumns,
  });

  if (error) {
    // The unique index normalises the pair, so this fires whichever end the reader entered it
    // from -- which is exactly how the duplicate got made.
    return error.code === DUPLICATE_PAIR ? duplicateConnectionMessage(other.name) : error.message;
  }

  return null;
}

/**
 * Where a rejected connection goes back to. `at` + `for` put the message under the character
 * whose form was rejected, and the fragment -- an element inside that character's disclosure --
 * re-opens the collapsed section in browsers that expand <details> for a fragment.
 */
export const connectionErrorUrl = (bookId: string, characterId: string, message: string) =>
  `/books/${bookId}?error=${encodeURIComponent(message)}&at=connections&for=${characterId}#character-${characterId}-relationships`;

/**
 * The form field names of one existing connection's editor row. Named per connection because
 * every row now belongs to the character form: plain `type` / `other_character_id` would
 * collide with the Link row and with each other. One helper, so the page and both endpoints
 * cannot drift apart on a spelling.
 */
export const connectionFields = (connectionId: string) => ({
  type: `conn_type_${connectionId}`,
  other: `conn_other_${connectionId}`,
});

/** An existing connection as stored, for comparing against what the form submitted. */
export interface StoredConnection {
  id: string;
  character_b_id: string;
  type: string | null;
  custom_type_id: string | null;
}

export type ConnectionEdits =
  | { kind: "ok"; edits: { id: string; command: CreateRelationshipCommand }[] }
  | { kind: "invalid"; message: string };

/**
 * Which of this character's connections the reader changed in the editor rows without
 * pressing the row's tick. Pure, so it is testable.
 *
 * Driven by the stored rows, never by the form's keys: a posted field naming a connection this
 * character does not own is simply never looked at. A row whose fields were not posted at all
 * is skipped, and an unchanged row is skipped too -- Save must not rewrite every connection
 * each time the reader fixes a typo in a name.
 */
export function readConnectionEdits(
  get: (name: string) => FormDataEntryValue | null,
  stored: StoredConnection[],
): ConnectionEdits {
  const edits: { id: string; command: CreateRelationshipCommand }[] = [];

  for (const row of stored) {
    const fields = connectionFields(row.id);
    const type = get(fields.type);
    const other = get(fields.other);
    if (type === null && other === null) continue;

    const parsed = createRelationshipSchema.safeParse({ type, other_character_id: other });
    if (!parsed.success) return { kind: "invalid", message: parsed.error.issues[0].message };

    const storedType = row.type ?? row.custom_type_id;
    if (parsed.data.type === storedType && parsed.data.other_character_id === row.character_b_id) continue;

    edits.push({ id: row.id, command: parsed.data });
  }

  return { kind: "ok", edits };
}

/**
 * Change an existing connection's type and/or other end. Shared by the row's tick and by the
 * character's Save. Returns the sentence to show the reader, or null on success.
 */
export async function updateConnection(
  supabase: Supabase,
  anchor: { id: string; book_id: string },
  connectionId: string,
  command: CreateRelationshipCommand,
): Promise<string | null> {
  if (anchor.id === command.other_character_id) {
    return "A character cannot be related to itself";
  }

  const { data: other } = await supabase
    .from("characters")
    .select("id, book_id, name")
    .eq("id", command.other_character_id)
    .maybeSingle<{ id: string; book_id: string; name: string }>();

  if (other?.book_id !== anchor.book_id) {
    return "That character is not in this book";
  }

  // A connection belongs to the character it was created from, which is `character_a_id`, so
  // the anchor can only be that column. The read is what refuses a posted anchor that does not
  // own this relationship, rather than letting the update rewrite somebody else's end.
  const { data: existing } = await supabase
    .from("relationships")
    .select("character_a_id")
    .eq("id", connectionId)
    .maybeSingle<{ character_a_id: string }>();

  if (!existing) {
    return "Relationship not found";
  }
  if (existing.character_a_id !== anchor.id) {
    return "That character is not part of this relationship";
  }

  // Both type columns are always written, so an edit can move a connection from a shared type
  // to a custom one and back without tripping the exactly-one-source check.
  const typeColumns = await resolveTypeColumns(supabase, command.type, anchor.book_id);
  if (typeColumns === null) {
    return "That relationship type does not exist";
  }

  const { data: updated, error } = await supabase
    .from("relationships")
    .update({ character_b_id: command.other_character_id, ...typeColumns })
    .eq("id", connectionId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return error.code === DUPLICATE_PAIR ? duplicateConnectionMessage(other.name) : error.message;
  }
  // Zero rows means the row was not this reader's; RLS already handled it.
  return updated ? null : "Relationship not found";
}
