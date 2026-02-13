"use client";

import React, { useMemo, useState } from "react";

type Entry =
  | { id: string; kind: "voice"; time: string; transcriptPreview: string; status: "ready" | "processing" | "error" }
  | { id: string; kind: "report"; time: string; title: string; preview: string; status: "draft" | "approved" };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function FieldConsolePage() {
  const [online, setOnline] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processingStage, setProcessingStage] = useState<null | "Uploading" | "Transcribing" | "Drafting">(null);

  const [entries, setEntries] = useState<Entry[]>([
    // start empty in production; leaving one "example" makes the UI feel real in dev
    {
      id: "ex1",
      kind: "report",
      time: "09:35 AM",
      title: "Draft daily report",
      preview: "Summary, manpower, work completed, deliveries, delays, safety notes.",
      status: "draft",
    },
  ]);

  // simple local timer so the UI feels like a device
  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const mmss = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [seconds]);

  async function startRecordingMock() {
    // UI-only: simulate a real recorder flow (no mic API yet)
    setRecording(true);
    setSeconds(0);
    setProcessingStage(null);
  }

  async function stopRecordingMock() {
    setRecording(false);

    // add a voice entry
    const voiceId = crypto.randomUUID();
    setEntries((prev) => [
      {
        id: voiceId,
        kind: "voice",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        transcriptPreview: "...generating transcript preview...",
        status: "processing",
      },
      ...prev,
    ]);

    // simulate pipeline stages so it feels like a serious tool
    setProcessingStage("Uploading");
    await sleep(650);

    // simulate offline failure gracefully
    if (!online) {
      setProcessingStage(null);
      setEntries((prev) =>
        prev.map((e) => (e.id === voiceId && e.kind === "voice" ? { ...e, status: "error", transcriptPreview: "Upload failed. Saved locally for retry." } : e))
      );
      return;
    }

    setProcessingStage("Transcribing");
    await sleep(900);

    setEntries((prev) =>
      prev.map((e) =>
        e.id === voiceId && e.kind === "voice"
          ? { ...e, status: "ready", transcriptPreview: "We had 12 electricians. Rain delayed concrete pour. Steel delivery late. No safety incidents." }
          : e
      )
    );

    setProcessingStage("Drafting");
    await sleep(900);

    // add report entry
    setEntries((prev) => [
      {
        id: crypto.randomUUID(),
        kind: "report",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        title: "Draft daily report",
        preview: "Auto-generated report ready for review: summary, manpower, delays, deliveries, safety.",
        status: "draft",
      },
      ...prev,
    ]);

    setProcessingStage(null);
  }

  function retryUploads() {
    // UI-only: flip online and "retry"
    setOnline(true);
    setEntries((prev) =>
      prev.map((e) => (e.kind === "voice" && e.status === "error" ? { ...e, status: "processing", transcriptPreview: "Retrying..." } : e))
    );
    // In real version: enqueue a retry job for failed uploads
  }

  return (
    <main className="mx-auto w-full max-w-[920px] px-4 pb-10 pt-5 sm:px-6">
      {/* Context bar */}
      <header className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_10px_30px_rgba(0,0,0,0.35)] sm:px-5">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.16em] text-zinc-300/80">HAMMERVOICE</div>
          <div className="mt-1 truncate text-lg font-semibold text-zinc-50">Chattanooga Site A</div>
          <div className="mt-0.5 text-sm text-zinc-300/80">Daily Log - Today - Thu, Feb 12</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Pill tone={online ? "good" : "warn"}>{online ? "Online" : "Offline"}</Pill>
            <button
              onClick={() => setOnline((v) => !v)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.07]"
              title="Dev toggle"
            >
              Toggle
            </button>
          </div>
          <div className="text-xs text-zinc-400">Last sync: {online ? "2m ago" : "-"}</div>
        </div>
      </header>

      {/* Capture + status */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.45)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold text-zinc-50">Record Daily Update</div>
            <div className="mt-1 text-sm text-zinc-300/80">
              60-90 sec. Say: work done, manpower, deliveries, issues, delays, safety.
            </div>
          </div>

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <SmallButton disabled>+ Add Photos</SmallButton>
            <SmallButton disabled>+ Attach Plan/Spec</SmallButton>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {/* Primary record button */}
          <button
            onMouseDown={startRecordingMock}
            onMouseUp={stopRecordingMock}
            onTouchStart={startRecordingMock}
            onTouchEnd={stopRecordingMock}
            onClick={() => (recording ? stopRecordingMock() : startRecordingMock())}
            className={cx(
              "group relative w-full rounded-2xl border px-5 py-4 text-left shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition",
              recording
                ? "border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/12"
                : "border-white/12 bg-white/[0.05] hover:bg-white/[0.07]"
            )}
            aria-pressed={recording}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div
                    className={cx(
                      "h-3 w-3 rounded-full",
                      recording ? "bg-rose-400 shadow-[0_0_0_6px_rgba(244,63,94,0.12)]" : "bg-emerald-400/80 shadow-[0_0_0_6px_rgba(16,185,129,0.10)]"
                    )}
                  />
                  <div className="truncate text-sm font-semibold text-zinc-50">
                    {recording ? "Recording..." : "Hold to Record"}
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-300/70">
                  {recording ? "Release to stop and generate report" : "Tap also works. Keep it short and factual."}
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-200">
                {recording ? mmss : "Ready"}
              </div>
            </div>

            {/* subtle highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
          </button>

          {/* Pipeline status */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300/80">
              <StatusDot ok label="Mic" />
              <StatusDot ok={online} label="Network" />
              <StatusDot ok label="Storage" />
              <StatusDot ok label="Queue" />
              <span className="text-zinc-400">Status: {recording ? "Recording" : processingStage ? processingStage : "Ready"}</span>
            </div>

            {!online && (
              <button
                onClick={retryUploads}
                className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/15"
              >
                Retry Upload
              </button>
            )}
          </div>

          {/* Processing hint */}
          {processingStage && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200">
              <span className="font-semibold">Processing:</span> {processingStage}...
              <span className="ml-2 text-zinc-400">You can leave this screen; results will appear below.</span>
            </div>
          )}
        </div>
      </section>

      {/* Output stream */}
      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.35)] sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-zinc-50">Today's Activity</div>
            <div className="mt-0.5 text-sm text-zinc-300/80">Voice updates and generated reports.</div>
          </div>
          <SmallButton onClick={() => setEntries([])}>Clear (dev)</SmallButton>
        </div>

        <div className="mt-4 space-y-3">
          {entries.length === 0 ? (
            <EmptyState />
          ) : (
            entries.map((e) => (
              <div key={e.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-zinc-400">{e.time}</span>
                      {e.kind === "voice" ? (
                        <Pill tone={e.status === "error" ? "warn" : e.status === "processing" ? "neutral" : "good"}>
                          {e.status === "processing" ? "Processing" : e.status === "error" ? "Upload failed" : "Voice update"}
                        </Pill>
                      ) : (
                        <Pill tone={e.status === "approved" ? "good" : "neutral"}>{e.status === "approved" ? "Approved" : "Draft report"}</Pill>
                      )}
                    </div>

                    {e.kind === "voice" ? (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-200">{e.transcriptPreview}</p>
                    ) : (
                      <>
                        <div className="mt-2 text-sm font-semibold text-zinc-50">{e.title}</div>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-200/90">{e.preview}</p>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {e.kind === "voice" ? (
                      <>
                        <SmallButton disabled={e.status !== "ready"}>Generate Report</SmallButton>
                        <SmallButton>Open</SmallButton>
                      </>
                    ) : (
                      <>
                        <SmallButton>Open</SmallButton>
                        <SmallButton>Export PDF</SmallButton>
                        <SmallButton>Copy</SmallButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="mt-6 text-xs text-zinc-500">
        UI-only build: recording/upload is mocked. Wire API later.
      </footer>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
      <div className="text-sm font-semibold text-zinc-50">No entries yet</div>
      <div className="mt-1 text-sm text-zinc-300/80">Record your first update. Reports will appear here automatically.</div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "neutral" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "good" && "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
        tone === "warn" && "border-amber-400/20 bg-amber-500/10 text-amber-200",
        tone === "neutral" && "border-white/10 bg-white/[0.04] text-zinc-200"
      )}
    >
      {children}
    </span>
  );
}

function SmallButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-zinc-500"
          : "border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]"
      )}
    >
      {children}
    </button>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx("h-2 w-2 rounded-full", ok ? "bg-emerald-400/80" : "bg-amber-400/80")} />
      <span>{label}</span>
    </span>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
