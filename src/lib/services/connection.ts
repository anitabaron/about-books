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
