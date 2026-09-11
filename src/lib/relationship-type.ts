import { z } from "zod";
import type { createClient } from "@/lib/supabase";

/**
 * The type `<select>` submits ONE field with two possible meanings: a shared type's slug (a
 * row of `relationship_type_presets`), or the uuid of a reader-defined type. Turning that into database columns
 * was duplicated in both write endpoints, which is how the two copies could drift apart on a
 * rule neither of them states out loud: the update path must write BOTH columns every time,
 * because writing one leaves the other set and trips `relationships_one_type`.
 *
 * Split the way the parked note proposed: a pure classifier that can be tested by a command,
 * and the book-membership check, which needs the client.
 */

/** Which of the two type sources a submitted value names. */
export type TypeChoice = { kind: "shared"; type: string } | { kind: "custom"; id: string };

/** The pair of columns on `public.relationships`. Exactly one is ever set. */
export interface TypeColumns {
  type: string | null;
  custom_type_id: string | null;
}

/**
 * Read the submitted value's SHAPE. Pure, so the branch is checkable without a database.
 *
 * A uuid means a reader-defined type; anything else is read as a shared type's slug. It used
 * to be the other way round -- membership of a hardcoded list decided "shared", and everything
 * else fell through to "custom" -- but the shared names are rows now, so the only thing this
 * function can know on its own is which of the two shapes it is looking at.
 *
 * Classification deliberately accepts a slug that names no preset: whether the row exists is
 * `resolveTypeColumns`'s question, and answering it here would need the database this function
 * exists to stay free of.
 */
export function classifyTypeChoice(choice: string): TypeChoice {
  return z.uuid().safeParse(choice).success ? { kind: "custom", id: choice } : { kind: "shared", type: choice };
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
 * Does this slug name one of the shared types? Compared against the rows, so a sixth preset
 * needs no code change — and so the endpoints can turn "you picked a shared name" into a
 * sentence instead of letting the database answer with a constraint violation.
 *
 * Callers doing a name comparison must normalise first: `relationship_types_not_shared`
 * compares `lower(btrim(name))`, so anything else would refuse names the constraint accepts.
 */
export async function isPresetSlug(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  slug: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("relationship_type_presets")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle<{ slug: string }>();

  return data !== null;
}

/**
 * Resolve a submitted choice to columns, confirming the type actually exists: a shared slug
 * must name a preset row, and a custom id must belong to the same book as the characters. RLS
 * checks ownership, not the relation between rows, so the second check is what stops a
 * hand-crafted post borrowing another book's vocabulary.
 *
 * Returns null for both failures, and the caller says the same thing about each — deliberately.
 * A reader cannot tell another reader's type from a typo, because RLS makes them
 * indistinguishable, so a message that separated the cases would be inventing a distinction.
 *
 * The shared branch costs a query it did not used to. That is the price of the names being
 * data; the foreign key would refuse a bad value anyway, but with a raw error rather than a
 * sentence.
 */
export async function resolveTypeColumns(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  choice: string,
  bookId: string,
): Promise<TypeColumns | null> {
  const classified = classifyTypeChoice(choice);
  if (classified.kind === "shared") {
    return (await isPresetSlug(supabase, classified.type)) ? columnsFor(classified) : null;
  }

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
