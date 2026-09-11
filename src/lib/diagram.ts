import type { Connection, ConnectionCharacter } from "@/lib/connections";

/**
 * Layout for the cast map. Pure: characters and connections in, coordinates out — no
 * Supabase client, no `Astro`, no DOM. That is deliberate, and the same reason
 * `buildConnections` was extracted: geometry living in page frontmatter is unreachable by
 * any command, and this is the only place the map's rules can be checked.
 *
 * Every rule here came out of drawing `mockup-cast-map.html` and looking at it. Several
 * reversed a decision that had looked right on paper.
 */

/** One character placed on the drawing. */
export interface MapNode {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Where the name sits relative to the dot, so the caller can anchor the text. */
  labelX: number;
  labelY: number;
  anchor: "start" | "middle" | "end";
  /** No connections at all. Drawn hollow: the cast holds them, so the map must too. */
  isolated: boolean;
  focus: boolean;
}

/** One connection, already split into the two visible segments with the gap between them. */
export interface MapEdge {
  id: string;
  /** One entry per way this pair is connected; the caller stacks them on the edge. */
  labels: string[];
  /** Two segments; the second is null when the edge was too short to cut a gap into. */
  segments: { x1: number; y1: number; x2: number; y2: number }[];
  labelX: number;
  labelY: number;
  /** Degrees, already flipped so the text never reads upside down. */
  labelAngle: number;
}

export interface CastMap {
  width: number;
  height: number;
  nodes: MapNode[];
  edges: MapEdge[];
}

/** One undirected connection between two characters of this cast. */
export interface MapLink {
  id: string;
  a: string;
  b: string;
  /** Two characters can be connected more than once, so an edge carries every type name. */
  labels: string[];
}

/** Arc reserved per node on the rim. 132 px fits "ANTAGONIST" at the label size. */
export const ARC_PER_NODE = 132;

/**
 * Labels are monospace (IBM Plex Mono at 8.5px plus 0.08em tracking), so the width follows
 * from the character count — roughly 5.9 px each. This has to work without measuring, because
 * the layout runs on the server where there is nothing to measure.
 */
export const labelWidth = (text: string): number => text.length * 5.9;

/** Stacked labels are centred on the edge, so the gap must clear the widest of them. */
export const widestLabel = (labels: readonly string[]): number =>
  labels.reduce((w, t) => Math.max(w, labelWidth(t)), 0);

/**
 * `buildConnections` indexes every relationship under BOTH of its characters, which is right
 * for the list and wrong for the map: drawing both entries would put two lines on top of each
 * other. De-duplicate on the connection id, which is the relationship row.
 */
export function toLinks(connectionsByCharacter: ReadonlyMap<string, Connection[]>): MapLink[] {
  const seen = new Map<string, MapLink>();
  for (const [characterId, connections] of connectionsByCharacter) {
    for (const c of connections) {
      // One edge per PAIR, not per relationship. Two characters can be connected more than
      // once -- "mieszka z" and "romantic" between the same two people -- and drawing those
      // as separate edges puts two lines in exactly the same place on the rim, and gives the
      // same neighbour two spokes in the person view, where they then render as two people.
      // Keyed on the unordered pair so it does not matter which end we arrive from.
      const pair = [characterId, c.otherId].sort().join("~");
      const existing = seen.get(pair);
      if (existing) {
        if (!existing.labels.includes(c.typeLabel)) existing.labels.push(c.typeLabel);
      } else {
        seen.set(pair, { id: c.id, a: characterId, b: c.otherId, labels: [c.typeLabel] });
      }
    }
  }
  return [...seen.values()];
}

/**
 * Order the rim so connected characters sit next to each other. Most edges then run as short
 * arcs instead of chords through the middle, which is the cheapest legibility win available —
 * it is sorting, not an algorithm. Greedy: start from the busiest character and keep taking
 * the most-connected neighbour that is still unplaced.
 */
export function orderForRim(
  characters: readonly ConnectionCharacter[],
  links: readonly MapLink[],
): ConnectionCharacter[] {
  const degree = new Map<string, number>();
  const neighbours = new Map<string, string[]>();
  for (const c of characters) {
    degree.set(c.id, 0);
    neighbours.set(c.id, []);
  }
  for (const l of links) {
    degree.set(l.a, (degree.get(l.a) ?? 0) + 1);
    degree.set(l.b, (degree.get(l.b) ?? 0) + 1);
    neighbours.get(l.a)?.push(l.b);
    neighbours.get(l.b)?.push(l.a);
  }

  // Typed explicitly: from a bare `map` the tuple widens to (string | ConnectionCharacter)[],
  // the Map degrades to any, and every value read out of it stops being checked.
  const byId = new Map<string, ConnectionCharacter>(characters.map((c) => [c.id, c]));
  const remaining = new Set(characters.map((c) => c.id));
  const ordered: ConnectionCharacter[] = [];
  const busiest = (ids: Iterable<string>) =>
    [...ids].sort((x, y) => (degree.get(y) ?? 0) - (degree.get(x) ?? 0) || x.localeCompare(y))[0];

  while (remaining.size > 0) {
    let current: string | undefined = busiest(remaining);
    while (current !== undefined) {
      remaining.delete(current);
      const node = byId.get(current);
      if (node) ordered.push(node);
      const adjacent: string[] = neighbours.get(current) ?? [];
      const next = adjacent.filter((n) => remaining.has(n));
      current = next.length > 0 ? busiest(next) : undefined;
    }
  }
  return ordered;
}

/**
 * Shrink the canvas to what is actually drawn and move the drawing into it.
 *
 * Both layouts place things on a circle, so the natural canvas is a square the size of the
 * whole rim — but a drawing rarely fills it. A person view with two connections is a vertical
 * strip down the middle of a square twice as wide as it needs, which produced a horizontal
 * scrollbar for a drawing that had room to spare. Measuring the real extent, labels included,
 * removes the scrollbar wherever it was not earned.
 */
function fitCanvas(nodes: MapNode[], edges: MapEdge[], pad: number): { width: number; height: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const push = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };

  for (const n of nodes) {
    push(n.x, n.y);
    // Names are serif 13px, so roughly 6.5px a character; which side of labelX they occupy
    // depends on the anchor.
    const w = n.name.length * 6.5;
    const left = n.anchor === "end" ? w : n.anchor === "middle" ? w / 2 : 0;
    const right = n.anchor === "start" ? w : n.anchor === "middle" ? w / 2 : 0;
    push(n.labelX - left, n.labelY - 13);
    push(n.labelX + right, n.labelY + 5);
  }
  for (const e of edges) {
    for (const s of e.segments) {
      push(s.x1, s.y1);
      push(s.x2, s.y2);
    }
    // Rotated, so the label can extend in either axis: take the widest either way.
    const reach = Math.max(widestLabel(e.labels) / 2, e.labels.length * 6);
    push(e.labelX - reach, e.labelY - reach);
    push(e.labelX + reach, e.labelY + reach);
  }

  if (xs.length === 0) return { width: 2 * pad, height: 2 * pad };

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const dx = pad - minX;
  const dy = pad - minY;

  for (const n of nodes) {
    n.x += dx;
    n.y += dy;
    n.labelX += dx;
    n.labelY += dy;
  }
  for (const e of edges) {
    for (const s of e.segments) {
      s.x1 += dx;
      s.y1 += dy;
      s.x2 += dx;
      s.y2 += dy;
    }
    e.labelX += dx;
    e.labelY += dy;
  }

  return {
    width: Math.ceil(Math.max(...xs) - minX + 2 * pad),
    height: Math.ceil(Math.max(...ys) - minY + 2 * pad),
  };
}

/** Rotate a label to its edge, flipping anything that would otherwise read upside down. */
function readableAngle(dx: number, dy: number): number {
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  else if (deg < -90) deg += 180;
  return deg;
}

/**
 * Cut a gap into the edge where the label sits. The gap handles the label's own line; a
 * paper-coloured halo in CSS handles other edges crossing underneath, and long labels that
 * overflow the gap the cap allows.
 */
function segmentsWithGap(
  p: { x: number; y: number },
  q: { x: number; y: number },
  labelX: number,
  labelY: number,
  gapWidth: number,
): MapEdge["segments"] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const along = (labelX - p.x) * ux + (labelY - p.y) * uy;
  // Capped at a quarter of the edge from the centre of the label, so a word can never eat
  // the whole line: a quarter each side always leaves half the edge drawn. A long label
  // therefore overflows its gap rather than erasing the connection, and the halo in CSS is
  // what keeps it readable where it does.
  const half = Math.min(gapWidth / 2, len * 0.25);
  const from = Math.max(0, along - half);
  const to = Math.min(len, along + half);

  return [
    { x1: p.x, y1: p.y, x2: p.x + ux * from, y2: p.y + uy * from },
    { x1: p.x + ux * to, y1: p.y + uy * to, x2: q.x, y2: q.y },
  ];
}

/**
 * Every character on a rim, connections as chords. The canvas is sized by the cast rather
 * than by the screen — each node gets a fixed slice of arc, so the radius grows with the
 * count and the frame scrolls. That is what keeping every label costs, and it was the
 * deliberate trade.
 */
export function layoutCircle(
  characters: readonly ConnectionCharacter[],
  links: readonly MapLink[],
  options: { arcPerNode?: number; pad?: number } = {},
): CastMap {
  const arc = options.arcPerNode ?? ARC_PER_NODE;
  const pad = options.pad ?? 86;
  const ordered = orderForRim(characters, links);
  const radius = Math.max((ordered.length * arc) / (2 * Math.PI), 96);
  const size = Math.round(2 * (radius + pad));
  const cx = size / 2;
  const cy = size / 2;

  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.a, (degree.get(l.a) ?? 0) + 1);
    degree.set(l.b, (degree.get(l.b) ?? 0) + 1);
  }

  const placed = new Map<string, { x: number; y: number; angle: number }>();
  const nodes: MapNode[] = ordered.map((c, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ordered.length;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    placed.set(c.id, { x, y, angle });
    const out = 15;
    const cos = Math.cos(angle);
    return {
      id: c.id,
      name: c.name,
      x,
      y,
      labelX: x + out * cos,
      labelY: y + out * Math.sin(angle) + 4,
      anchor: cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle",
      isolated: !degree.get(c.id),
      focus: false,
    };
  });

  const edges: MapEdge[] = [];
  links.forEach((l, i) => {
    const p = placed.get(l.a);
    const q = placed.get(l.b);
    if (!p || !q) return;
    // Midpoint of THIS edge, nudged along it so the midpoints of crossing chords do not land
    // on the same spot. A fixed fraction from the `a` end instead piles every label onto
    // whichever character happens to be stored as `a` — in a dense graph, one hub.
    const t = 0.5 + [0, 0.05, -0.05][i % 3];
    const labelX = p.x + (q.x - p.x) * t;
    const labelY = p.y + (q.y - p.y) * t;
    edges.push({
      id: l.id,
      labels: l.labels,
      // The gap has to clear the WIDEST of the stacked names, not the first one.
      segments: segmentsWithGap(p, q, labelX, labelY, widestLabel(l.labels) + 5),
      labelX,
      labelY,
      labelAngle: readableAngle(q.x - p.x, q.y - p.y),
    });
  });

  return { ...fitCanvas(nodes, edges, 16), nodes, edges };
}

/** How far along its spoke an edge label sits, measured from the focus. */
const LABEL_T = 0.6;
/** Clear space between the outer end of a label and the character's dot. */
const NODE_GAP = 18;
/** Clear space between the inner end of a label and the focus dot with its name. */
const FOCUS_GAP = 26;

/**
 * One character in the middle, only their own connections around them. The spoke count is
 * that character's degree, not the size of the cast, so this stays readable however large the
 * book gets — and it is literally US-01: from a character to all their connections in one
 * interaction.
 */
export function layoutEgo(
  characters: readonly ConnectionCharacter[],
  links: readonly MapLink[],
  focusId: string,
  options: { pad?: number; radius?: number } = {},
): CastMap {
  // Typed explicitly: from a bare `map` the tuple widens to (string | ConnectionCharacter)[],
  // the Map degrades to any, and every value read out of it stops being checked.
  const byId = new Map<string, ConnectionCharacter>(characters.map((c) => [c.id, c]));
  const focus = byId.get(focusId);
  const spokes = links
    .filter((l) => l.a === focusId || l.b === focusId)
    .map((l) => ({ id: l.id, other: l.a === focusId ? l.b : l.a, labels: l.labels }));

  // The star has to be long enough for the WORDS, not just for the spokes. An edge label lies
  // along its spoke, centred at LABEL_T of the way out, so a long reader-defined type reaches
  // past the node it belongs to and crowds the focus at the other end -- and a radius derived
  // only from the spoke count cannot know that. Solve for the radius each end needs and take
  // the longest requirement:
  //
  //   outer:  LABEL_T*r + w/2 + NODE_GAP  <= r
  //   inner:  LABEL_T*r - w/2             >= FOCUS_GAP
  //
  // With six spokes labelled "mieszka w kamienicy" (112 px) the old floor of 126 px left the
  // label running from 19 px to 131 px along a 126 px spoke: over the node, into the middle.
  const widest = widestLabel(spokes.flatMap((s) => s.labels));
  const outerNeeds = (widest / 2 + NODE_GAP) / (1 - LABEL_T);
  const innerNeeds = (widest / 2 + FOCUS_GAP) / LABEL_T;
  const radius =
    options.radius ??
    Math.max(118, (spokes.length * ARC_PER_NODE) / (2 * Math.PI), spokes.length === 0 ? 0 : outerNeeds, innerNeeds);
  const pad = options.pad ?? 74;
  const size = Math.round(2 * (radius + pad));
  const cx = size / 2;
  const cy = size / 2;

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  if (focus) {
    nodes.push({
      id: focus.id,
      name: focus.name,
      x: cx,
      y: cy,
      labelX: cx,
      labelY: cy + 23,
      anchor: "middle",
      isolated: spokes.length === 0,
      focus: true,
    });
  }

  spokes.forEach((s, i) => {
    const other = byId.get(s.other);
    if (!other) return;
    // Spread over the whole circle, not a minimum of three: with two connections a floor of
    // three left one spoke pointing up and the other off to a corner, and two thirds of the
    // frame empty. Evenly divided reads as a star whatever the degree.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / spokes.length;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const cos = Math.cos(angle);
    nodes.push({
      id: other.id,
      name: other.name,
      x,
      y,
      labelX: x + 14 * cos,
      labelY: y + 14 * Math.sin(angle) + 4,
      anchor: cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle",
      isolated: false,
      focus: false,
    });

    const labelX = cx + radius * LABEL_T * cos;
    const labelY = cy + radius * LABEL_T * Math.sin(angle);
    edges.push({
      id: s.id,
      labels: s.labels,
      segments: segmentsWithGap({ x: cx, y: cy }, { x, y }, labelX, labelY, widestLabel(s.labels) + 5),
      labelX,
      labelY,
      labelAngle: readableAngle(x - cx, y - cy),
    });
  });

  return { ...fitCanvas(nodes, edges, 16), nodes, edges };
}

/**
 * Who the person view opens on when the URL names nobody: the busiest character, because an
 * isolated one would open on an empty drawing. Ties break on name so the same book always
 * opens the same way.
 */
export function defaultFocus(characters: readonly ConnectionCharacter[], links: readonly MapLink[]): string | null {
  if (characters.length === 0) return null;
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.a, (degree.get(l.a) ?? 0) + 1);
    degree.set(l.b, (degree.get(l.b) ?? 0) + 1);
  }
  return [...characters].sort(
    (x, y) => (degree.get(y.id) ?? 0) - (degree.get(x.id) ?? 0) || x.name.localeCompare(y.name),
  )[0].id;
}
