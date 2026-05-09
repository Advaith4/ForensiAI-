import dagre from "dagre";
import type { Node, Edge } from "reactflow";
import type { CaseReport, TimelineEvent, RiskFlag } from "@/lib/types";

/* ── source → colour mapping ─────────────────────────────────── */
const SOURCE_COLORS: Record<string, string> = {
  cctv: "#a855f7",
  gps: "#22c55e",
  mobile: "#f59e0b",
  metadata: "#f59e0b",
  ai: "#22d3ee",
};

/* ── fallback demo data (used when API fails) ─────────────────── */
export const FALLBACK_TIMELINE: TimelineEvent[] = [
  { timestamp: "2026-05-08T19:45:00", source: "cctv", event: "Dark sedan detected entering south parking lot via Gate C", severity: "medium" },
  { timestamp: "2026-05-08T20:02:00", source: "gps", event: "Victim device GPS shows steady northbound movement on service road", severity: "medium" },
  { timestamp: "2026-05-08T20:14:00", source: "mobile", event: "Outgoing call to unknown prepaid number — 47 seconds", severity: "high" },
  { timestamp: "2026-05-08T20:22:00", source: "cctv", event: "Victim last seen on camera near loading bay entrance", severity: "medium" },
  { timestamp: "2026-05-08T20:31:00", source: "gps", event: "Sudden speed escalation to 94 km/h on restricted service lane", severity: "high" },
  { timestamp: "2026-05-08T20:38:00", source: "mobile", event: "Device connects to unfamiliar WiFi SSID near industrial block", severity: "medium" },
  { timestamp: "2026-05-08T20:46:00", source: "metadata", event: "Image EXIF places device at isolated parking lane — GPS mismatch", severity: "high" },
  { timestamp: "2026-05-08T20:58:00", source: "ai", event: "AI: Anomaly detected — device location contradicts CCTV trajectory", severity: "high" },
  { timestamp: "2026-05-08T21:03:00", source: "cctv", event: "Unidentified vehicle exits corridor via emergency gate", severity: "high" },
  { timestamp: "2026-05-08T21:15:00", source: "ai", event: "AI: Suspicious correlation — vehicle exit coincides with signal loss", severity: "high" },
];

export const FALLBACK_FLAGS: RiskFlag[] = [
  { name: "blood_footprint_mismatch", description: "Blood footprint pattern inconsistent with reported victim position at scene", score: 88 },
  { name: "hidden_bloodstained_shirt", description: "Concealed bloodstained clothing found 200m from primary scene", score: 92 },
  { name: "premeditation_tool_bag", description: "Bag containing zip ties, tape, and gloves found in vehicle trunk", score: 95 },
];

/* ── node dimensions for layout ───────────────────────────────── */
const NODE_W = 280;
const NODE_H = 100;

/* ── build nodes + edges from a CaseReport ────────────────────── */
export function buildGraph(report: CaseReport): { nodes: Node[]; edges: Edge[] } {
  const rawTimeline = report.timeline ?? report.structured_report?.timeline_analysis?.events ?? FALLBACK_TIMELINE;
  const rawFlags = report.flags ?? report.structured_report?.risk_assessment?.flags ?? FALLBACK_FLAGS;

  const timeline = [...rawTimeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (timeline.length === 0) return { nodes: [], edges: [] };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  /* timeline nodes */
  timeline.forEach((evt, i) => {
    const id = `tl-${i}`;
    const borderColor = SOURCE_COLORS[evt.source] ?? "#64748b";
    const isHigh = evt.severity === "high";

    nodes.push({
      id,
      type: "forensicNode",
      position: { x: 0, y: 0 },
      data: {
        kind: "timeline" as const,
        event: evt.event,
        timestamp: evt.timestamp,
        source: evt.source,
        severity: evt.severity,
        borderColor,
        isHigh,
      },
    });

    if (i > 0) {
      const prevIsHigh = timeline[i - 1].severity === "high";
      edges.push({
        id: `e-tl-${i - 1}-${i}`,
        source: `tl-${i - 1}`,
        target: id,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: prevIsHigh || isHigh ? "#f43f5e" : "#22d3ee",
          strokeWidth: prevIsHigh || isHigh ? 2.5 : 1.5,
          filter: "drop-shadow(0 0 4px rgba(34,211,238,.4))",
        },
      });
    }
  });

  /* risk / anomaly nodes */
  const lastTlId = `tl-${timeline.length - 1}`;

  rawFlags.forEach((flag, i) => {
    const id = `risk-${i}`;
    const isHigh = flag.score > 80;

    nodes.push({
      id,
      type: "forensicNode",
      position: { x: 0, y: 0 },
      data: {
        kind: "risk" as const,
        name: flag.name,
        description: flag.description,
        score: flag.score,
        borderColor: "#ef4444",
        isHigh,
      },
    });

    edges.push({
      id: `e-risk-${i}`,
      source: lastTlId,
      target: id,
      type: "smoothstep",
      animated: true,
      style: {
        stroke: isHigh ? "#f43f5e" : "#ef4444",
        strokeWidth: isHigh ? 2.5 : 1.5,
        strokeDasharray: "6 3",
        filter: "drop-shadow(0 0 6px rgba(239,68,68,.5))",
      },
    });
  });

  return applyLayout(nodes, edges);
}

/* ── dagre layout with manual fallback ────────────────────────── */
function applyLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  try {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });

    nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    const positioned = nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
    });

    return { nodes: positioned, edges };
  } catch {
    /* manual fallback — simple horizontal chain */
    const positioned = nodes.map((n, i) => ({
      ...n,
      position: {
        x: i * 300,
        y: n.data.kind === "risk" ? 220 : 60,
      },
    }));
    return { nodes: positioned, edges };
  }
}
