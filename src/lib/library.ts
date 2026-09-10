import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

export interface LibraryEntry {
  id: string;
  title: string;
  finished_at: string | null;
}

export interface Library {
  reading: LibraryEntry[];
  finished: LibraryEntry[];
  error: string | null;
}

export const EMPTY_LIBRARY: Library = { reading: [], finished: [], error: null };

/**
 * The rail shows the whole library on every app screen, so this runs once per
 * request from AppLayout rather than being repeated per page.
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
