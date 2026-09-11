/**
 * Shared entities and DTOs. Per CLAUDE.md this is the single home for types that cross
 * module boundaries — append here rather than introducing another location.
 *
 * Conventions established by roadmap F-01 and copied by every later table:
 *  - the entity type mirrors its migration's columns one-to-one;
 *  - client-facing commands are Zod schemas, with their TypeScript types *inferred* from
 *    them, so the runtime validator and the compile-time type cannot drift apart;
 *  - server-owned columns (`id`, `user_id`, `created_at`, `updated_at`) are never accepted
 *    from a client. `user_id` is filled by `default auth.uid()` in the database, and the
 *    insert policy rejects any attempt to claim another reader's id.
 */

import { z } from "zod";

/**
 * A row of `public.books`.
 * Mirrors `supabase/migrations/20260909155950_create_books_with_rls.sql`.
 * Timestamps arrive from Supabase as ISO strings, not Date objects.
 */
export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  /** Null means currently reading. A timestamp means finished on that date — there is no separate status flag. */
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

/** `title text not null` — the column permits '', which is never a useful title. */
const titleField = z.string().trim().min(1, "Title is required").max(300, "Title is too long");

/**
 * `author text` (nullable). A cleared form field arrives as '', which is not the same
 * thing as "unknown" — normalise it to null so the column holds one representation of
 * absence rather than two.
 */
const authorField = z
  .string()
  .trim()
  .max(200, "Author name is too long")
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createBookSchema = z.object({
  title: titleField,
  author: authorField,
});

export const updateBookSchema = z
  .object({
    title: titleField.optional(),
    author: authorField,
  })
  .refine((command) => command.title !== undefined || command.author !== undefined, {
    message: "Provide at least one field to update",
  });

export type CreateBookCommand = z.infer<typeof createBookSchema>;
export type UpdateBookCommand = z.infer<typeof updateBookSchema>;

/**
 * A row of `public.characters`.
 * Mirrors `supabase/migrations/20260910093251_create_characters_with_rls.sql`.
 */
export interface Character {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * `name text not null`. US-02 requires a character to be creatable from a name ALONE, so
 * this is the only required field in the create command — nothing else may block submission.
 */
const characterNameField = z.string().trim().min(1, "Name is required").max(200, "Name is too long");

/**
 * `description text` (nullable). The note is filled in later as reading progresses, so it is
 * optional at creation. A cleared field arrives as "" and is normalised to null, exactly as
 * `authorField` does for books.
 */
const characterDescriptionField = z
  .string()
  .trim()
  .max(2000, "Description is too long")
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createCharacterSchema = z.object({
  name: characterNameField,
  description: characterDescriptionField,
});

export const updateCharacterSchema = z
  .object({
    name: characterNameField.optional(),
    description: characterDescriptionField,
  })
  .refine((command) => command.name !== undefined || command.description !== undefined, {
    message: "Provide at least one field to update",
  });

export type CreateCharacterCommand = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterCommand = z.infer<typeof updateCharacterSchema>;

/**
 * A row of `public.relationships`.
 * Mirrors `supabase/migrations/20260910103932_create_relationships_with_rls.sql`.
 *
 * One-way: the row belongs to the character in `character_a_id` -- the one whose card it was
 * created from -- and renders only there. `character_b_id` is who it points at. Recording the
 * reverse is a second row, and the reader's choice to make.
 */
export interface Relationship {
  id: string;
  user_id: string;
  character_a_id: string;
  character_b_id: string;
  /**
   * A shared type's slug -- a row of `public.relationship_type_presets`, enforced by a foreign
   * key -- or `null` when `custom_type_id` is set. Exactly one of the two.
   *
   * Plain `string`, not a union of the five: the names are data now, so the set is not known at
   * compile time. A wrong value is refused by the foreign key, which is the same guarantee the
   * union used to give, moved to where the names actually live.
   */
  type: string | null;
  /** A reader-defined type's id, or `null` when `type` is set. Never the type's NAME. */
  custom_type_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A row of `public.relationship_types` -- a name this reader coined for ONE of their books.
 * Mirrors `supabase/migrations/20260910140215_create_relationship_types_with_rls.sql`.
 *
 * The shared types are NOT rows here -- they live in `public.relationship_type_presets` and
 * are immutable from the application. This table holds only what the reader added alongside
 * them, and `relationship_types_not_shared` stops a name here shadowing one of those.
 */
export interface RelationshipTypeRow {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const relationshipTypeNameField = z
  .string()
  .trim()
  .min(1, "Give the type a name")
  .max(40, "Keep the name under 40 characters");
// No "that is already a shared type" rule here any more: the shared names are rows, and a
// schema cannot read the database. The endpoints check the presets before writing and produce
// that sentence themselves, exactly as they already translate SQLSTATE 23505 into one.

export const createRelationshipTypeSchema = z.object({ name: relationshipTypeNameField });
export const updateRelationshipTypeSchema = z.object({ name: relationshipTypeNameField });

export type CreateRelationshipTypeCommand = z.infer<typeof createRelationshipTypeSchema>;
export type UpdateRelationshipTypeCommand = z.infer<typeof updateRelationshipTypeSchema>;

/**
 * The type `<select>` submits ONE field carrying two possible meanings: a shared type's slug,
 * or the uuid of a reader-defined type. The schema can only check that something was picked --
 * whether the value names a real type is a question about rows, answered by
 * `resolveTypeColumns` and, failing that, by the two foreign keys.
 *
 * It used to test membership of a hardcoded list here. Once the shared types became rows, that
 * test could only have been kept by copying the names back into the code, which is the
 * duplication this change removed.
 */
export const relationshipTypeChoice = z.string().min(1, "Pick a relationship type");

export type RelationshipTypeChoice = z.infer<typeof relationshipTypeChoice>;

/**
 * The add form lives under one character, so it submits only the OTHER end plus the type.
 * The anchor comes from the route's `[id]` param, never from the form.
 */
export const createRelationshipSchema = z.object({
  other_character_id: z.uuid("Pick a character"),
  type: relationshipTypeChoice,
});

/**
 * Editing keeps the anchor character fixed and replaces the other end and/or the type.
 * `anchor_id` names the character whose card the form sits on; it is validated but never
 * written. The route re-reads the row to confirm that character really owns this connection --
 * a posted anchor that does not is refused rather than allowed to rewrite someone else's.
 */
export const updateRelationshipSchema = z.object({
  anchor_id: z.uuid(),
  other_character_id: z.uuid("Pick a character"),
  type: relationshipTypeChoice,
});

export type CreateRelationshipCommand = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipCommand = z.infer<typeof updateRelationshipSchema>;
