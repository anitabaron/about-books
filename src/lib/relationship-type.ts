import type { createClient } from "@/lib/supabase";
import { isSharedType, type RelationshipType } from "@/types";

/**
 * The type `<select>` submits ONE field with two possible meanings: one of FR-004's five
 * shared literals, or the uuid of a reader-defined type. Turning that into database columns
 * was duplicated in both write endpoints, which is how the two copies could drift apart on a
 * rule neither of them states out loud: the update path must write BOTH columns every time,
 * because writing one leaves the other set and trips `relationships_one_type`.
 *
 * Split the way the parked note proposed: a pure classifier that can be tested by a command,
 * and the book-membership check, which needs the client.
 */

/** Which of the two type sources a submitted value names. */
export type TypeChoice = { kind: "shared"; type: RelationshipType } | { kind: "custom"; id: string };

/** The pair of columns on `public.relationships`. Exactly one is ever set. */
export interface TypeColumns {
  type: RelationshipType | null;
  custom_type_id: string | null;
}

/** Read the submitted value's shape. Pure, so the branch is checkable without a database. */
export function classifyTypeChoice(choice: string): TypeChoice {
  return isSharedType(choice) ? { kind: "shared", type: choice } : { kind: "custom", id: choice };
}

/**
 * Both columns, always. Writing only the one that applies is the mistake the duplication was
 * hiding: on an edit it leaves the previous source set and the row then holds two type
 * sources, which the check constraint rejects with a raw database error.
 */
export function columnsFor(choice: TypeChoice): TypeColumns {
  return choice.kind === "shared"
    ? { type: choice.type, custom_type_id: null }
    : { type: null, custom_type_id: choice.id };
}

/**
 * Resolve a submitted choice to columns, confirming a custom type belongs to the same book as
 * the characters. RLS checks ownership, not the relation between rows, so this check is what
 * stops a hand-crafted post borrowing another book's vocabulary. Returns null when the id is
 * not a type of this book — which includes another reader's type, since RLS makes that
 * indistinguishable from a typo.
 */
export async function resolveTypeColumns(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  choice: string,
  bookId: string,
): Promise<TypeColumns | null> {
  const classified = classifyTypeChoice(choice);
  if (classified.kind === "shared") return columnsFor(classified);

  const { data: customType } = await supabase
    .from("relationship_types")
    .select("id, book_id")
    .eq("id", classified.id)
    .maybeSingle<{ id: string; book_id: string }>();

  if (customType?.book_id !== bookId) return null;
  return columnsFor(classified);
}

/**
 * SQLSTATE 23505 on `relationships` means the unique index on the normalised pair rejected a
 * connection that already exists. Both write paths translate it the same way, so the sentence
 * lives here rather than in each of them.
 */
export const DUPLICATE_PAIR = "23505";

export const duplicateConnectionMessage = (otherName: string): string =>
  `You have already recorded that connection with ${otherName}. Change the existing one instead.`;
