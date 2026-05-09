import {
  AlertTriangle,
  Brain,
  Camera,
  MapPin,
  Smartphone,
  X,
} from "lucide-react";

/* ── icon lookup ────────── */
const SOURCE_ICON: Record<string, typeof Camera> = {
  cctv: Camera,
  gps: MapPin,
  mobile: Smartphone,
  metadata: Smartphone,
  ai: Brain,
};

const SOURCE_COLORS: Record<string, string> = {
  cctv: "#a855f7",
  gps: "#22c55e",
  mobile: "#f59e0b",
  metadata: "#f59e0b",
  ai: "#22d3ee",
};

function fmtTimestamp(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

type DetailsPanelProps = {
  data: Record<string, unknown> | null;
  onClose: () => void;
};

export default function DetailsPanel({ data, onClose }: DetailsPanelProps) {
  const open = data !== null;
  const kind = (data?.kind as string) ?? "timeline";

  return (
    <div
      className={`absolute right-0 top-0 z-30 flex h-full flex-col border-l border-white/10 bg-[#0d1117]/80 backdrop-blur-xl transition-all duration-300 ${
        open
          ? "w-[380px] translate-x-0 opacity-100"
          : "w-0 translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      {data && (
        <div className="flex h-full flex-col overflow-y-auto p-5">
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {kind === "risk" ? (
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/15">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
              ) : (
                (() => {
                  const src = data.source as string;
                  const Icon = SOURCE_ICON[src] ?? Brain;
                  const color = SOURCE_COLORS[src] ?? "#64748b";
                  return (
                    <div
                      className="grid h-9 w-9 place-items-center rounded-xl"
                      style={{ background: `${color}22` }}
                    >
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                  );
                })()
              )}
              <span className="text-sm font-bold uppercase tracking-wider text-slate-300">
                {kind === "risk" ? "Risk Intelligence" : "Event Details"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 h-px bg-white/10" />

          {/* ── risk detail ── */}
          {kind === "risk" && (
            <div className="mt-5 space-y-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Flag
                </span>
                <h3 className="mt-1 text-lg font-bold text-white">
                  {((data.name as string) ?? "").replace(/_/g, " ")}
                </h3>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Description
                </span>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {(data.description as string) ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/8 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">
                    Risk Score
                  </p>
                  <p className="text-3xl font-black text-red-300">
                    {(data.score as number) ?? 0}
                    <span className="text-sm font-semibold text-red-400">/100</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── timeline detail ── */}
          {kind === "timeline" && (
            <div className="mt-5 space-y-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Event
                </span>
                <p className="mt-1 text-sm leading-6 text-white">
                  {(data.event as string) ?? "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Source
                  </span>
                  <p
                    className="mt-1 text-sm font-semibold uppercase"
                    style={{ color: SOURCE_COLORS[data.source as string] ?? "#64748b" }}
                  >
                    {(data.source as string) ?? "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Severity
                  </span>
                  <p
                    className={`mt-1 text-sm font-semibold uppercase ${
                      (data.severity as string) === "high"
                        ? "text-red-400"
                        : "text-slate-300"
                    }`}
                  >
                    {(data.severity as string) ?? "—"}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Timestamp
                </span>
                <p className="mt-1 text-sm text-slate-300">
                  {fmtTimestamp((data.timestamp as string) ?? "")}
                </p>
              </div>
            </div>
          )}

          {/* footer badge */}
          <div className="mt-auto pt-6">
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3 text-center text-[11px] font-semibold tracking-wider text-cyan-300/70">
              ForensiAI Investigation Intelligence
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
