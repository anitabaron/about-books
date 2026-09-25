import { describe, expect, it } from "vitest";
import { connectionFields, readConnectionEdits, readPendingConnection, type StoredConnection } from "./connection";

/**
 * The character's Save carries the Link row. What this holds down: an untouched row changes
 * nothing, a fully picked one becomes a connection, and a half-picked one is refused rather
 * than silently dropped -- which is what Save used to do with all three.
 */

const OTHER = "a7ad43ae-6e13-4e4d-9238-8eeed84ee160";

describe("readPendingConnection", () => {
  it("treats an untouched Link row as no connection", () => {
    expect(readPendingConnection("", "")).toEqual({ kind: "none" });
  });

  it("treats a missing Link row as no connection", () => {
    // A book with one character renders no Link row, so neither field is posted at all.
    expect(readPendingConnection(null, null)).toEqual({ kind: "none" });
  });

  it("turns a fully picked row into a connection", () => {
    expect(readPendingConnection("family", OTHER)).toEqual({
      kind: "ok",
      command: { type: "family", other_character_id: OTHER },
    });
  });

  it("refuses a type without a person", () => {
    expect(readPendingConnection("family", "")).toEqual({ kind: "invalid", message: "Pick a character" });
  });

  it("refuses a person without a type", () => {
    expect(readPendingConnection("", OTHER)).toEqual({ kind: "invalid", message: "Pick a relationship type" });
  });
});

/**
 * The "Change or remove" rows submit with Save too. What this holds down: an untouched row is
 * not rewritten, a changed one is, and only connections this character actually owns are ever
 * read from the form.
 */
describe("readConnectionEdits", () => {
  const CONN = "0b6f3a5e-5c1e-4f0e-9a52-3f1d2c7b8e90";
  const OTHER_2 = "5d2c0f1a-9e7b-4c3d-8a6f-1b2e3c4d5e6f";
  const CUSTOM = "c4a1e2b3-7d6f-4e5a-9b8c-0d1e2f3a4b5c";
  const stored: StoredConnection[] = [{ id: CONN, character_b_id: OTHER, type: "family", custom_type_id: null }];
  const fields = connectionFields(CONN);
  const formOf = (values: Record<string, string>) => (name: string) => values[name] ?? null;

  it("skips a row the reader did not change", () => {
    expect(readConnectionEdits(formOf({ [fields.type]: "family", [fields.other]: OTHER }), stored)).toEqual({
      kind: "ok",
      edits: [],
    });
  });

  it("picks up a changed type that was never ticked", () => {
    expect(readConnectionEdits(formOf({ [fields.type]: "rival", [fields.other]: OTHER }), stored)).toEqual({
      kind: "ok",
      edits: [{ id: CONN, command: { type: "rival", other_character_id: OTHER } }],
    });
  });

  it("picks up a changed person", () => {
    expect(readConnectionEdits(formOf({ [fields.type]: "family", [fields.other]: OTHER_2 }), stored)).toEqual({
      kind: "ok",
      edits: [{ id: CONN, command: { type: "family", other_character_id: OTHER_2 } }],
    });
  });

  it("compares a custom type by its id", () => {
    const custom: StoredConnection[] = [{ id: CONN, character_b_id: OTHER, type: null, custom_type_id: CUSTOM }];
    expect(readConnectionEdits(formOf({ [fields.type]: CUSTOM, [fields.other]: OTHER }), custom)).toEqual({
      kind: "ok",
      edits: [],
    });
  });

  it("skips a row whose fields were not posted", () => {
    expect(readConnectionEdits(formOf({}), stored)).toEqual({ kind: "ok", edits: [] });
  });

  it("ignores posted fields for a connection this character does not own", () => {
    const foreign = connectionFields(OTHER_2);
    expect(readConnectionEdits(formOf({ [foreign.type]: "rival", [foreign.other]: OTHER }), stored)).toEqual({
      kind: "ok",
      edits: [],
    });
  });

  it("refuses a row with a field emptied", () => {
    expect(readConnectionEdits(formOf({ [fields.type]: "", [fields.other]: OTHER }), stored)).toEqual({
      kind: "invalid",
      message: "Pick a relationship type",
    });
  });
});
