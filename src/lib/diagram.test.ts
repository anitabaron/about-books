import { describe, expect, it } from "vitest";
import {
  ARC_PER_NODE,
  defaultFocus,
  labelWidth,
  layoutCircle,
  layoutEgo,
  orderForRim,
  toLinks,
  type MapLink,
} from "./diagram";
import type { Connection } from "./connections";

/**
 * The map's rules are geometry, so nothing else can check them: the compiler sees numbers,
 * and a page-level check cannot tell a readable drawing from a pile of overlapping text.
 */

const CAST = [
  { id: "helena", name: "Helena" },
  { id: "tomasz", name: "Tomasz" },
  { id: "antoni", name: "Antoni" },
  { id: "wiktor", name: "Wiktor" },
];

const LINKS: MapLink[] = [
  { id: "r1", a: "helena", b: "tomasz", label: "romantic" },
  { id: "r2", a: "tomasz", b: "antoni", label: "antagonist" },
  { id: "r3", a: "helena", b: "antoni", label: "mieszka z" },
];

const conn = (id: string, otherId: string, otherName: string, label: string): Connection => ({
  id,
  otherId,
  otherName,
  typeLabel: label,
  isCustomType: false,
  typeValue: label,
});

describe("toLinks", () => {
  it("draws each relationship once, though the cast indexes it under both ends", () => {
    const byCharacter = new Map<string, Connection[]>([
      ["helena", [conn("r1", "tomasz", "Tomasz", "romantic")]],
      ["tomasz", [conn("r1", "helena", "Helena", "romantic")]],
    ]);
    const links = toLinks(byCharacter);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ id: "r1", label: "romantic" });
    expect([links[0].a, links[0].b].sort()).toEqual(["helena", "tomasz"]);
  });

  it("returns nothing for a cast with no connections", () => {
    expect(toLinks(new Map())).toEqual([]);
  });

  it("draws one edge per PAIR, joining the names when two characters are connected twice", () => {
    // Two relationships between the same two people. As separate edges they land in exactly
    // the same place on the rim -- one line hiding another -- and in the person view they give
    // the same neighbour two spokes, where they render as two different people.
    const byCharacter = new Map<string, Connection[]>([
      ["harey", [conn("r1", "snaut", "Snaut", "mieszka z"), conn("r2", "snaut", "Snaut", "romantic")]],
      ["snaut", [conn("r1", "harey", "Harey", "mieszka z"), conn("r2", "harey", "Harey", "romantic")]],
    ]);
    const links = toLinks(byCharacter);
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe("mieszka z · romantic");
  });

  it("keeps separate pairs apart", () => {
    const byCharacter = new Map<string, Connection[]>([
      ["harey", [conn("r1", "snaut", "Snaut", "romantic"), conn("r2", "kelvin", "Kris Kelvin", "family")]],
    ]);
    expect(toLinks(byCharacter)).toHaveLength(2);
  });
});

describe("orderForRim", () => {
  it("seats connected characters next to each other", () => {
    // A chain, not a triangle: on a four-seat rim a triangle CANNOT have all three pairs
    // adjacent, so asserting that would test the impossible rather than the ordering.
    const chain = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ];
    const chained: MapLink[] = [
      { id: "1", a: "a", b: "b", label: "x" },
      { id: "2", a: "b", b: "c", label: "x" },
      { id: "3", a: "c", b: "d", label: "x" },
    ];
    const order = orderForRim(chain, chained).map((c) => c.id);
    const gap = (x: string, y: string) => {
      const n = order.length;
      const d = Math.abs(order.indexOf(x) - order.indexOf(y));
      return Math.min(d, n - d);
    };
    expect(gap("a", "b")).toBe(1);
    expect(gap("b", "c")).toBe(1);
    expect(gap("c", "d")).toBe(1);
  });

  it("keeps every character, including one with no connections", () => {
    const order = orderForRim(CAST, LINKS).map((c) => c.id);
    expect(order).toHaveLength(CAST.length);
    expect(order).toContain("wiktor");
  });
});

describe("layoutCircle", () => {
  it("grows the canvas with the cast rather than fitting a screen", () => {
    const small = layoutCircle(CAST, LINKS);
    const big = layoutCircle(
      Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, name: `Character ${i}` })),
      [],
    );
    expect(big.width).toBeGreaterThan(small.width);
    // radius = n * arc / 2pi, so the rim always has room for the label beside each node.
    const arcAvailable = (Math.PI * (big.width - 2 * 86)) / 14;
    expect(arcAvailable).toBeGreaterThanOrEqual(ARC_PER_NODE - 1);
  });

  it("marks a character with no connections as isolated, and keeps them on the map", () => {
    const map = layoutCircle(CAST, LINKS);
    const wiktor = map.nodes.find((n) => n.id === "wiktor");
    expect(wiktor?.isolated).toBe(true);
    expect(map.nodes).toHaveLength(CAST.length);
  });

  it("draws every node inside the canvas", () => {
    const map = layoutCircle(CAST, LINKS);
    for (const n of map.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.y).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(map.width);
      expect(n.y).toBeLessThan(map.height);
    }
  });

  it("puts each label near the midpoint of its OWN edge, not clustered on one character", () => {
    // The bug this replaces: a fixed fraction from the `a` end piles every label onto
    // whichever character is stored as `a` — here, the hub.
    const hub: MapLink[] = [
      { id: "r1", a: "helena", b: "tomasz", label: "a" },
      { id: "r2", a: "helena", b: "antoni", label: "b" },
      { id: "r3", a: "helena", b: "wiktor", label: "c" },
    ];
    const map = layoutCircle(CAST, hub);
    const helena = map.nodes.find((n) => n.id === "helena");
    const distances = map.edges.map((e) => Math.hypot(e.labelX - (helena?.x ?? 0), e.labelY - (helena?.y ?? 0)));
    const spread = Math.max(...distances) - Math.min(...distances);
    // If they clustered on the hub they would all sit at nearly the same distance from it.
    expect(spread).toBeGreaterThan(20);
  });

  it("never rotates a label past upright", () => {
    const map = layoutCircle(CAST, LINKS);
    for (const e of map.edges) {
      expect(e.labelAngle).toBeGreaterThanOrEqual(-90);
      expect(e.labelAngle).toBeLessThanOrEqual(90);
    }
  });

  it("cuts a gap for the label, leaving line on both sides", () => {
    const map = layoutCircle(CAST, LINKS);
    const cut = map.edges.filter((e) => e.segments.length === 2);
    expect(cut.length).toBeGreaterThan(0);
    for (const e of cut) {
      for (const s of e.segments) {
        expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeGreaterThan(0);
      }
    }
  });

  it("never lets a label eat more than half its edge", () => {
    // The protection that matters: however long a reader-defined type is, at least half the
    // line stays drawn, so a connection never degrades into two loose dots. The label
    // overflows its gap instead, and the halo in CSS keeps it readable.
    const pair = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const long: MapLink[] = [{ id: "r", a: "a", b: "b", label: "a-very-long-custom-relationship-type" }];
    const map = layoutCircle(pair, long, { arcPerNode: 40, pad: 10 });
    const drawn = map.edges[0].segments.reduce((sum, s) => sum + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
    const node = map.nodes;
    const whole = Math.hypot(node[1].x - node[0].x, node[1].y - node[0].y);
    expect(drawn).toBeGreaterThanOrEqual(whole * 0.5 - 0.01);
  });
});

describe("layoutEgo", () => {
  it("puts the focus in the middle and only its own connections around it", () => {
    const map = layoutEgo(CAST, LINKS, "helena");
    const focus = map.nodes.find((n) => n.focus);
    expect(focus?.id).toBe("helena");
    expect(focus?.x).toBeCloseTo(map.width / 2, 5);
    expect(map.edges).toHaveLength(2);
    expect(map.nodes.map((n) => n.id).sort()).toEqual(["antoni", "helena", "tomasz"]);
  });

  it("gives a neighbour ONE spoke however many ways they are connected", () => {
    const twice: MapLink[] = [{ id: "r1", a: "helena", b: "tomasz", label: "romantic · mieszka z" }];
    const map = layoutEgo(CAST, twice, "helena");
    expect(map.edges).toHaveLength(1);
    expect(map.nodes.filter((n) => n.id === "tomasz")).toHaveLength(1);
  });

  it("does not care how large the rest of the cast is", () => {
    const crowd = [...CAST, ...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, name: `X${i}` }))];
    const map = layoutEgo(crowd, LINKS, "helena");
    expect(map.nodes).toHaveLength(3);
  });

  it("renders a character with no connections as a lone focus rather than failing", () => {
    const map = layoutEgo(CAST, LINKS, "wiktor");
    expect(map.edges).toEqual([]);
    expect(map.nodes).toHaveLength(1);
    expect(map.nodes[0]).toMatchObject({ id: "wiktor", focus: true, isolated: true });
  });

  it("returns an empty drawing for a focus that is not in the cast", () => {
    const map = layoutEgo(CAST, LINKS, "nobody");
    expect(map.nodes).toEqual([]);
    expect(map.edges).toEqual([]);
  });
});

describe("defaultFocus", () => {
  it("opens on the busiest character, so the first drawing is not empty", () => {
    // In LINKS all three connected characters have degree 2, so that set tests the tiebreak,
    // not "busiest". Give Helena a fourth link to make her genuinely the busiest.
    const busier: MapLink[] = [...LINKS, { id: "r4", a: "helena", b: "wiktor", label: "ally" }];
    expect(defaultFocus(CAST, busier)).toBe("helena");
    // And with the original set the tie falls to the first name alphabetically.
    expect(defaultFocus(CAST, LINKS)).toBe("antoni");
  });

  it("breaks ties by name so the same book always opens the same way", () => {
    const tie = [
      { id: "z", name: "Zofia" },
      { id: "a", name: "Alicja" },
    ];
    expect(defaultFocus(tie, [])).toBe("a");
  });

  it("answers null for a book with no characters", () => {
    expect(defaultFocus([], [])).toBeNull();
  });
});

describe("labelWidth", () => {
  it("grows with the text, since the server cannot measure it", () => {
    expect(labelWidth("ally")).toBeLessThan(labelWidth("antagonist"));
    expect(labelWidth("")).toBe(0);
  });
});
