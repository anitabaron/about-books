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
