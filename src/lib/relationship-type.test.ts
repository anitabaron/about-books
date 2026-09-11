import { describe, expect, it } from "vitest";
import { classifyTypeChoice, columnsFor, duplicateConnectionMessage } from "./relationship-type";

/**
 * The rule these tests hold down is the one the two duplicated copies never stated: BOTH
 * columns are written every time. Writing only the one that applies leaves the other source
 * set on an edit, and the row then carries two type sources.
 */

describe("classifyTypeChoice", () => {
  it("reads a shared literal as shared", () => {
    expect(classifyTypeChoice("family")).toEqual({ kind: "shared", type: "family" });
    expect(classifyTypeChoice("antagonist")).toEqual({ kind: "shared", type: "antagonist" });
  });

  it("reads anything else as a custom type's id", () => {
    expect(classifyTypeChoice("a7ad43ae-6e13-4e4d-9238-8eeed84ee160")).toEqual({
      kind: "custom",
      id: "a7ad43ae-6e13-4e4d-9238-8eeed84ee160",
    });
  });

  it("does not treat a custom type NAMED like a shared one as shared", () => {
    // The database refuses such a name (relationship_types_not_shared), but the classifier
    // must not depend on that: it sees ids, not names.
    expect(classifyTypeChoice("00000000-0000-4000-8000-000000000001").kind).toBe("custom");
  });
});

describe("columnsFor", () => {
  it("writes both columns for a shared type, clearing the custom one", () => {
    expect(columnsFor({ kind: "shared", type: "romantic" })).toEqual({
      type: "romantic",
      custom_type_id: null,
    });
  });

  it("writes both columns for a custom type, clearing the shared one", () => {
    expect(columnsFor({ kind: "custom", id: "t-1" })).toEqual({ type: null, custom_type_id: "t-1" });
  });

  it("always sets exactly one source, whichever branch it took", () => {
    for (const choice of [{ kind: "shared", type: "ally" } as const, { kind: "custom", id: "t-2" } as const]) {
      const columns = columnsFor(choice);
      const set = [columns.type, columns.custom_type_id].filter((v) => v !== null);
      expect(set).toHaveLength(1);
    }
  });
});

describe("duplicateConnectionMessage", () => {
  it("names the other character, since that is what the reader is looking at", () => {
    expect(duplicateConnectionMessage("Snaut")).toContain("Snaut");
  });
});
