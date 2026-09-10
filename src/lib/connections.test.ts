import { describe, expect, it } from "vitest";
import { buildConnections, resolveTypeLabel, type ConnectionRelationship } from "./connections";

/**
 * These tests exist because nothing else checks the two-source contract. The compiler cannot:
 * `src/db/database.types.ts` is imported by nothing in `src/`, so the schema's
 * `type: string | null` and `src/types.ts`'s `RelationshipType` are never reconciled. A read
 * site that forgets a type can be null fails at runtime as a blank label, not at build time.
 */

const HAREY = { id: "c-harey", name: "Harey" };
const SNAUT = { id: "c-snaut", name: "Snaut" };
const KELVIN = { id: "c-kelvin", name: "Kris Kelvin" };

const LIVES_WITH = { id: "t-lives-with", name: "lives with" };

const rel = (over: Partial<ConnectionRelationship> = {}): ConnectionRelationship => ({
  id: "r-1",
  character_a_id: HAREY.id,
  character_b_id: SNAUT.id,
  type: "romantic",
  custom_type_id: null,
  ...over,
});

describe("resolveTypeLabel", () => {
  it("resolves a shared literal to itself", () => {
    expect(resolveTypeLabel({ type: "antagonist", custom_type_id: null }, new Map())).toEqual({
      label: "antagonist",
      isCustom: false,
      value: "antagonist",
    });
  });

  it("resolves a custom type id to the reader's own name", () => {
    const types = new Map([[LIVES_WITH.id, LIVES_WITH.name]]);
    expect(resolveTypeLabel({ type: null, custom_type_id: LIVES_WITH.id }, types)).toEqual({
      label: "lives with",
      isCustom: true,
      value: LIVES_WITH.id,
    });
  });

  it("returns null when a custom type id is missing from the map, rather than a label", () => {
    // The case the compiler cannot catch and the reader would see as a blank label.
    expect(resolveTypeLabel({ type: null, custom_type_id: "t-unknown" }, new Map())).toBeNull();
  });

  it("returns null when neither source is set", () => {
    expect(resolveTypeLabel({ type: null, custom_type_id: null }, new Map())).toBeNull();
  });

  it("returns null when both sources are set", () => {
    const types = new Map([[LIVES_WITH.id, LIVES_WITH.name]]);
    expect(resolveTypeLabel({ type: "ally", custom_type_id: LIVES_WITH.id }, types)).toBeNull();
  });
});

describe("buildConnections", () => {
  it("indexes a connection under BOTH characters", () => {
    const byCharacter = buildConnections([HAREY, SNAUT], [rel()]);

    expect([...byCharacter.keys()].sort()).toEqual([HAREY.id, SNAUT.id].sort());
    expect(byCharacter.get(HAREY.id)).toEqual([
      {
        id: "r-1",
        otherId: SNAUT.id,
        otherName: "Snaut",
        typeLabel: "romantic",
        isCustomType: false,
        typeValue: "romantic",
      },
    ]);
    expect(byCharacter.get(SNAUT.id)).toEqual([
      {
        id: "r-1",
        otherId: HAREY.id,
        otherName: "Harey",
        typeLabel: "romantic",
        isCustomType: false,
        typeValue: "romantic",
      },
    ]);
  });

  it("carries a custom type's name to both ends", () => {
    const byCharacter = buildConnections(
      [HAREY, SNAUT],
      [rel({ type: null, custom_type_id: LIVES_WITH.id })],
      [LIVES_WITH],
    );

    expect(byCharacter.get(HAREY.id)?.[0]).toMatchObject({ typeLabel: "lives with", isCustomType: true });
    expect(byCharacter.get(SNAUT.id)?.[0]).toMatchObject({ typeLabel: "lives with", isCustomType: true });
  });

  it("never renders a label as undefined when the type row is unknown", () => {
    const byCharacter = buildConnections([HAREY, SNAUT], [rel({ type: null, custom_type_id: "t-gone" })], []);

    // Skipped entirely rather than rendered with a blank or "undefined" type.
    expect(byCharacter.size).toBe(0);
    for (const list of byCharacter.values()) {
      for (const c of list) expect(c.typeLabel).not.toBe("undefined");
    }
  });

  it("keeps a shared-type connection and drops an unresolvable one in the same cast", () => {
    const byCharacter = buildConnections(
      [HAREY, SNAUT],
      [rel(), rel({ id: "r-2", type: null, custom_type_id: "t-gone" })],
      [],
    );

    expect(byCharacter.get(HAREY.id)).toHaveLength(1);
    expect(byCharacter.get(HAREY.id)?.[0].id).toBe("r-1");
  });

  it("skips a relationship reaching outside the cast", () => {
    const byCharacter = buildConnections([HAREY, SNAUT], [rel({ character_b_id: KELVIN.id })]);
    expect(byCharacter.size).toBe(0);
  });

  it("returns an empty map for a cast with no relationships", () => {
    expect(buildConnections([HAREY, SNAUT], []).size).toBe(0);
  });

  it("groups several connections under the same character", () => {
    const byCharacter = buildConnections(
      [HAREY, SNAUT, KELVIN],
      [rel(), rel({ id: "r-2", character_a_id: HAREY.id, character_b_id: KELVIN.id, type: "family" })],
      [],
    );

    expect(byCharacter.get(HAREY.id)).toHaveLength(2);
    expect(byCharacter.get(SNAUT.id)).toHaveLength(1);
    expect(byCharacter.get(KELVIN.id)).toHaveLength(1);
  });
});
