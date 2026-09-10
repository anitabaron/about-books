import type { Relationship, RelationshipTypeRow } from "@/types";

/** The subset of a character row this module needs: an id and a name to render. */
export type ConnectionCharacter = Pick<{ id: string; name: string }, "id" | "name">;

/** The subset of a relationship row this module needs. */
export type ConnectionRelationship = Pick<
  Relationship,
  "id" | "character_a_id" | "character_b_id" | "type" | "custom_type_id"
>;

/**
 * One end of a connection as the page renders it: who the other character is, and the label
 * for the relationship. `typeLabel` is a plain string because the two type sources -- a
 * shared literal held in code and a reader-defined row -- converge here and nowhere else.
 */
export interface Connection {
  id: string;
  otherId: string;
  otherName: string;
  typeLabel: string;
  /** True when the label came from a reader-defined type, which the form marks differently. */
  isCustomType: boolean;
  /** Whichever of the two sources identifies this type, ready to preselect in a `<select>`. */
  typeValue: string;
}

/**
 * Resolve a relationship's display label from whichever of the two sources it carries.
 *
 * Returns `null` when the row is unusable: no source set, both set, or a `custom_type_id`
 * with no matching row in `typeNamesById`. Returning null rather than a fallback string is
 * deliberate -- the caller skips the row instead of rendering a connection whose type nobody
 * can read. The database forbids the first two cases (`relationships_one_type`), and RLS
 * makes the third possible only for a row that is not this reader's.
 */
export function resolveTypeLabel(
  relationship: Pick<ConnectionRelationship, "type" | "custom_type_id">,
  typeNamesById: ReadonlyMap<string, string>,
): { label: string; isCustom: boolean; value: string } | null {
  const { type, custom_type_id } = relationship;

  if (type !== null && custom_type_id !== null) return null;
  if (type !== null) return { label: type, isCustom: false, value: type };
  if (custom_type_id === null) return null;

  const name = typeNamesById.get(custom_type_id);
  if (name === undefined) return null;
  return { label: name, isCustom: true, value: custom_type_id };
}

/**
 * Index every relationship under BOTH of its characters, so a connection renders beneath each
 * end. Relationships are undirected: which id sits in `character_a_id` depends only on whose
 * row the connection was created from, so neither column may be treated as the anchor.
 *
 * Pure by design -- no Supabase client, no `Astro` globals -- because this is the one place
 * the two-source type contract can be checked by a command rather than by remembering. The
 * compiler cannot help here: `src/db/database.types.ts` is imported by nothing, so nothing
 * reconciles the schema's `type: string | null` with `src/types.ts`.
 */
export function buildConnections(
  characters: readonly ConnectionCharacter[],
  relationships: readonly ConnectionRelationship[],
  customTypes: readonly Pick<RelationshipTypeRow, "id" | "name">[] = [],
): Map<string, Connection[]> {
  const byCharacter = new Map<string, Connection[]>();
  const nameById = new Map(characters.map((c) => [c.id, c.name]));
  const typeNamesById = new Map(customTypes.map((t) => [t.id, t.name]));

  for (const rel of relationships) {
    const resolved = resolveTypeLabel(rel, typeNamesById);
    if (resolved === null) continue;

    for (const [selfId, otherId] of [
      [rel.character_a_id, rel.character_b_id],
      [rel.character_b_id, rel.character_a_id],
    ]) {
      const otherName = nameById.get(otherId);
      // Defensive: a relationship reaching outside this cast is skipped rather than rendered
      // as "undefined". The create route requires a shared book, so this should be unreachable.
      if (!nameById.has(selfId) || otherName === undefined) continue;

      const list = byCharacter.get(selfId) ?? [];
      list.push({
        id: rel.id,
        otherId,
        otherName,
        typeLabel: resolved.label,
        isCustomType: resolved.isCustom,
        typeValue: resolved.value,
      });
      byCharacter.set(selfId, list);
    }
  }

  return byCharacter;
}
