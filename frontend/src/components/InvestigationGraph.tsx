import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { Network, Loader2 } from "lucide-react";

import { getReport } from "@/lib/api";
import { mockReport } from "@/lib/mock-data";
import { buildGraph, FALLBACK_TIMELINE, FALLBACK_FLAGS } from "@/lib/graphUtils";
import ForensicNode from "@/components/graph/CustomNode";
import DetailsPanel from "@/components/graph/DetailsPanel";
import type { CaseReport } from "@/lib/types";

/* ── register custom node types (stable ref) ──────────────────── */
const nodeTypes = { forensicNode: ForensicNode };

/* ── component ────────────────────────────────────────────────── */
export default function InvestigationGraph({ caseId }: { caseId: string }) {
  const [report, setReport] = useState<CaseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  /* fetch report or use fallback */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getReport(caseId)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) {
          /* use mockReport with fallback enrichment */
          setReport({
            ...mockReport,
            case_id: caseId,
            timeline:
              mockReport.timeline && mockReport.timeline.length > 0
                ? mockReport.timeline
                : FALLBACK_TIMELINE,
            flags:
              mockReport.flags && mockReport.flags.length > 0
                ? mockReport.flags
                : FALLBACK_FLAGS,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  /* build graph from report */
  const { initialNodes, initialEdges, hasTimeline } = useMemo(() => {
    if (!report) return { initialNodes: [], initialEdges: [], hasTimeline: false };

    const timeline =
      report.timeline ??
      report.structured_report?.timeline_analysis?.events ??
      [];

    if (timeline.length === 0) {
      return { initialNodes: [], initialEdges: [], hasTimeline: false };
    }

    const { nodes, edges } = buildGraph(report);
    return { initialNodes: nodes, initialEdges: edges, hasTimeline: true };
  }, [report]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  /* sync when initialNodes/initialEdges change (new report) */
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  /* node click handler */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { data: Record<string, unknown> }) => {
      setSelected(node.data);
    },
    []
  );

  const onPaneClick = useCallback(() => setSelected(null), []);

  /* ── loading state ── */
  if (loading) {
    return (
      <div className="flex h-[700px] items-center justify-center rounded-2xl border border-white/10 bg-[#0d1117]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm font-semibold text-slate-400">Loading investigation data…</p>
        </div>
      </div>
    );
  }

  /* ── empty state ── */
  if (!hasTimeline) {
    return (
      <div className="flex h-[700px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0d1117]">
        <Network className="h-16 w-16 text-cyan-500/30" />
        <p className="mt-4 max-w-md text-center text-lg font-semibold text-slate-400">
          Run AI analysis first to generate the investigation graph.
        </p>
      </div>
    );
  }

  /* ── graph ── */
  return (
    <div className="relative h-[700px] overflow-hidden rounded-2xl border border-white/10">
      {/* gradient background layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, #111827, #020617 70%), #0d1117",
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="z-10"
      >
        <Background color="#1e293b" gap={28} size={1} />
        <Controls
          className="!rounded-xl !border !border-white/10 !bg-[#0f172a]/90 !shadow-lg [&>button]:!border-white/10 [&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button:hover]:!bg-white/10"
          position="bottom-left"
        />
        <MiniMap
          nodeColor={(n) =>
            n.data?.kind === "risk"
              ? "#ef4444"
              : (n.data?.borderColor as string) ?? "#22d3ee"
          }
          maskColor="rgba(13,17,23,.85)"
          className="!rounded-xl !border !border-white/10 !bg-[#0f172a]/90"
          position="bottom-right"
        />
      </ReactFlow>

      {/* case header overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2.5 rounded-xl border border-cyan-300/15 bg-[#0d1117]/80 px-4 py-2.5 backdrop-blur-sm">
        <Network className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          Investigation Narrative
        </span>
        <span className="text-xs text-slate-500">·</span>
        <span className="text-xs text-slate-400">{caseId}</span>
        <span className="text-xs text-slate-500">·</span>
        <span className="text-xs text-slate-400">
          {nodes.filter((n) => n.data?.kind === "timeline").length} events
        </span>
        <span className="text-xs text-slate-400">
          {nodes.filter((n) => n.data?.kind === "risk").length} flags
        </span>
      </div>

      {/* details panel */}
      <DetailsPanel data={selected} onClose={() => setSelected(null)} />

      {/* inline styles for pulse animation */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
