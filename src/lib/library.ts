import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

export interface LibraryEntry {
  id: string;
  title: string;
  finished_at: string | null;
}

export interface ShelfEntry extends LibraryEntry {
  author: string | null;
  characters: number;
}

export interface Library {
  reading: LibraryEntry[];
  finished: LibraryEntry[];
  error: string | null;
}

export const EMPTY_LIBRARY: Library = { reading: [], finished: [], error: null };

/**
 * The rail shows the whole library on every app screen, so this runs once per
 * request from AppLayout rather than being repeated per page. Deliberately
 * lean — the rail renders titles only, and an aggregate join here would be
 * paid on every page load for something only the dashboard shows.
 *
 * RLS scopes the rows to the signed-in reader; no `user_id` filter is written
 * here, because adding one would duplicate the policy rather than reinforce it.
 */
export async function loadLibrary(supabase: SupabaseClient<Database> | null): Promise<Library> {
  if (!supabase) return { ...EMPTY_LIBRARY, error: "Supabase is not configured" };

  const { data, error } = await supabase
    .from("books")
    .select("id, title, finished_at")
    .order("created_at", { ascending: false });

  if (error) return { ...EMPTY_LIBRARY, error: error.message };

  return {
    reading: data.filter((b) => b.finished_at === null),
    finished: data.filter((b) => b.finished_at !== null),
    error: null,
  };
}

/**
 * The dashboard's "Reading now" shelf: title, author and how large the cast has
 * grown. `characters(count)` is a PostgREST embedded aggregate, so the cast
 * sizes arrive with the books — one round trip, not one per book.
 */
export async function loadReadingShelf(
  supabase: SupabaseClient<Database> | null,
): Promise<{ shelf: ShelfEntry[]; error: string | null }> {
  if (!supabase) return { shelf: [], error: "Supabase is not configured" };

  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, finished_at, characters(count)")
    .is("finished_at", null)
    .order("created_at", { ascending: false });

  if (error) return { shelf: [], error: error.message };

  return {
    shelf: data.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      finished_at: book.finished_at,
      // The aggregate comes back as an array with a single row; an empty array
      // means the join matched nothing, which is a cast of zero.
      characters: book.characters[0]?.count ?? 0,
    })),
    error: null,
  };
}

/** "1 character" / "3 characters" — never "1 characters". */
export function castLabel(n: number): string {
  return n === 1 ? "1 character" : `${n} characters`;
}
