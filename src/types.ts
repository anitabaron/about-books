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
 * The five relationship names from FR-004. Single source of truth: the Zod schema and the
 * form's select both read this, so they cannot drift, and the migration's check constraint
 * carries the same list.
 */
export const RELATIONSHIP_TYPES = ["family", "ally", "antagonist", "romantic", "other"] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/**
 * A row of `public.relationships`.
 * Mirrors `supabase/migrations/20260910103932_create_relationships_with_rls.sql`.
 *
 * Undirected: the row is rendered beneath both characters, and which id sits in
 * `character_a_id` depends only on whose row it was created from. Never assume the anchor.
 */
export interface Relationship {
  id: string;
  user_id: string;
  character_a_id: string;
  character_b_id: string;
  type: RelationshipType;
  created_at: string;
  updated_at: string;
}

/**
 * The add form lives under one character, so it submits only the OTHER end plus the type.
 * The anchor comes from the route's `[id]` param, never from the form.
 */
export const createRelationshipSchema = z.object({
  other_character_id: z.uuid("Pick a character"),
  type: z.enum(RELATIONSHIP_TYPES),
});

/**
 * Editing keeps the anchor character fixed and replaces the other end and/or the type.
 * `anchor_id` tells the route which column holds the anchor; it is validated but never
 * written, and the route re-reads the row rather than trusting it to decide the column.
 */
export const updateRelationshipSchema = z.object({
  anchor_id: z.uuid(),
  other_character_id: z.uuid("Pick a character"),
  type: z.enum(RELATIONSHIP_TYPES),
});

export type CreateRelationshipCommand = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipCommand = z.infer<typeof updateRelationshipSchema>;
