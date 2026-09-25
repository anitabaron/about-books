import { describe, expect, it } from "vitest";
import { readPendingConnection } from "./connection";

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
