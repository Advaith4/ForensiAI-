import { memo } from "react";
import { Handle, Position } from "reactflow";
import {
  AlertTriangle,
  Brain,
  Camera,
  MapPin,
  Smartphone,
} from "lucide-react";

/* ── icon lookup ──────────────────────────────────────────────── */
const SOURCE_ICON: Record<string, typeof Camera> = {
  cctv: Camera,
  gps: MapPin,
  mobile: Smartphone,
  metadata: Smartphone,
  ai: Brain,
};

/* ── helpers ──────────────────────────────────────────────────── */
function truncate(text: string, max = 60) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/* ── component ────────────────────────────────────────────────── */
function ForensicNodeInner({ data }: { data: Record<string, unknown> }) {
  const kind = data.kind as string;
  const borderColor = (data.borderColor as string) ?? "#64748b";
  const isHigh = data.isHigh as boolean;

  /* ── risk node ─────── */
  if (kind === "risk") {
    const name = data.name as string;
    const score = data.score as number;

    return (
      <div className="relative">
        {isHigh && (
          <span className="absolute -inset-1 rounded-2xl animate-[pulse-ring_2s_ease-in-out_infinite] border border-red-500/40" />
        )}
        <div
          className="relative min-w-[220px] max-w-[260px] rounded-xl border-l-[3px] bg-[#0f1729]/90 px-4 py-3 backdrop-blur-sm"
          style={{
            borderLeftColor: borderColor,
            boxShadow: isHigh
              ? "0 0 24px rgba(239,68,68,.35)"
              : "0 0 12px rgba(239,68,68,.18)",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
              Risk Flag
            </span>
            <span className="ml-auto rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300">
              {score}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-[1.4] text-slate-200">
            {truncate(name.replace(/_/g, " "), 50)}
          </p>
        </div>
        <Handle type="target" position={Position.Left} className="!bg-red-500 !w-2 !h-2 !border-0" />
      </div>
    );
  }

  /* ── timeline node ─── */
  const evtText = data.event as string;
  const source = data.source as string;
  const severity = data.severity as string;
  const timestamp = data.timestamp as string;
  const Icon = SOURCE_ICON[source] ?? Brain;

  return (
    <div className="relative">
      {isHigh && (
        <span className="absolute -inset-1 rounded-2xl animate-[pulse-ring_2s_ease-in-out_infinite] border border-red-500/40" />
      )}
      <div
        className="relative min-w-[220px] max-w-[260px] rounded-xl border-l-[3px] bg-[#0f1729]/90 px-4 py-3 backdrop-blur-sm"
        style={{
          borderLeftColor: borderColor,
          boxShadow: isHigh
            ? "0 0 20px rgba(239,68,68,.25)"
            : `0 0 12px ${borderColor}33`,
        }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" style={{ color: borderColor }} />
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${borderColor}22`, color: borderColor }}
          >
            {source}
          </span>
          {severity && (
            <span
              className={`ml-auto rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                severity === "high"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-slate-500/20 text-slate-400"
              }`}
            >
              {severity}
            </span>
          )}
        </div>
        <p className="mt-2 text-[12px] leading-[1.4] text-slate-200">
          {truncate(evtText)}
        </p>
        <p className="mt-1.5 text-[10px] text-slate-500">{fmtTime(timestamp)}</p>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-2 !h-2 !border-0" />
    </div>
  );
}

const ForensicNode = memo(ForensicNodeInner);
export default ForensicNode;
