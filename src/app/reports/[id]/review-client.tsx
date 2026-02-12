"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type WorkPerformedRow = {
  subcontractor: string;
  task: string;
  crewSize: string;
};

type DeliveryRow = {
  material: string;
  status: string;
};

type DelayRow = {
  reason: string;
  duration: string;
};

type ExtractedData = {
  workPerformed: WorkPerformedRow[];
  deliveries: DeliveryRow[];
  delays: DelayRow[];
  safetyNotes: string;
};

type ReviewClientProps = {
  initialReport: {
    id: string;
    status: "UPLOADING" | "DRAFT" | "PROCESSING" | "READY" | "FAILED";
    projectName: string;
    reportDateISO: string;
    reportDateLabel: string;
    transcriptText: string;
    extracted: ExtractedData;
  };
};

const newWorkPerformedRow = (): WorkPerformedRow => ({
  subcontractor: "",
  task: "",
  crewSize: "",
});

const newDeliveryRow = (): DeliveryRow => ({
  material: "",
  status: "",
});

const newDelayRow = (): DelayRow => ({
  reason: "",
  duration: "",
});

export const ReviewClient = ({ initialReport }: ReviewClientProps) => {
  const router = useRouter();
  const [formData, setFormData] = useState<ExtractedData>(initialReport.extracted);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = useMemo(
    () => initialReport.status !== "READY" && initialReport.status !== "FAILED",
    [initialReport.status],
  );

  useEffect(() => {
    if (!isProcessing) return;
    const interval = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isProcessing, router]);

  useEffect(() => {
    setFormData(initialReport.extracted);
  }, [initialReport.extracted, initialReport.id, initialReport.status]);

  const updateWorkPerformed = (
    index: number,
    field: keyof WorkPerformedRow,
    value: string,
  ) => {
    setFormData((prev) => {
      const next = [...prev.workPerformed];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, workPerformed: next };
    });
  };

  const updateDelivery = (index: number, field: keyof DeliveryRow, value: string) => {
    setFormData((prev) => {
      const next = [...prev.deliveries];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, deliveries: next };
    });
  };

  const updateDelay = (index: number, field: keyof DelayRow, value: string) => {
    setFormData((prev) => {
      const next = [...prev.delays];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, delays: next };
    });
  };

  const addWorkPerformed = () =>
    setFormData((prev) => ({
      ...prev,
      workPerformed: [...prev.workPerformed, newWorkPerformedRow()],
    }));

  const addDelivery = () =>
    setFormData((prev) => ({
      ...prev,
      deliveries: [...prev.deliveries, newDeliveryRow()],
    }));

  const addDelay = () =>
    setFormData((prev) => ({
      ...prev,
      delays: [...prev.delays, newDelayRow()],
    }));

  const exportPdf = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: initialReport.id,
          projectName: initialReport.projectName,
          reportDate: initialReport.reportDateISO,
          transcriptText: initialReport.transcriptText,
          extractedJson: formData,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to generate PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-construction-report-${initialReport.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not export report. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (initialReport.status === "FAILED") {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-red-300 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-red-800">Processing Failed</h1>
        <p className="mt-2 text-sm font-medium text-red-700">
          The AI pipeline could not process this audio. Please record again or contact support.
        </p>
      </section>
    );
  }

  if (isProcessing) {
    return (
      <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center rounded-2xl border border-zinc-300 bg-white p-6 shadow-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
        <h1 className="mt-4 text-2xl font-black text-zinc-900">Processing Report...</h1>
        <p className="mt-2 text-sm font-semibold text-zinc-600">
          We are transcribing and structuring your field notes now.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-6">
      <header className="border-b border-zinc-300 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900">DAILY CONSTRUCTION REPORT</h1>
        <div className="mt-3 flex flex-col gap-1 text-sm font-semibold text-zinc-700 sm:flex-row sm:gap-6">
          <p>Project: {initialReport.projectName}</p>
          <p>Date: {initialReport.reportDateLabel}</p>
          <p>Report ID: {initialReport.id}</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-300 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-zinc-900">Work Performed</h2>
              <button
                type="button"
                onClick={addWorkPerformed}
                className="rounded-md border border-zinc-900 bg-white px-3 py-1 text-xs font-bold uppercase text-zinc-900"
              >
                Add Row
              </button>
            </div>
            <div className="space-y-3">
              {formData.workPerformed.map((row, index) => (
                <div key={`work-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    value={row.subcontractor}
                    onChange={(e) => updateWorkPerformed(index, "subcontractor", e.target.value)}
                    placeholder="Subcontractor"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                  <input
                    value={row.task}
                    onChange={(e) => updateWorkPerformed(index, "task", e.target.value)}
                    placeholder="Task"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                  <input
                    value={row.crewSize}
                    onChange={(e) => updateWorkPerformed(index, "crewSize", e.target.value)}
                    placeholder="Crew Size"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-300 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-zinc-900">Deliveries</h2>
              <button
                type="button"
                onClick={addDelivery}
                className="rounded-md border border-zinc-900 bg-white px-3 py-1 text-xs font-bold uppercase text-zinc-900"
              >
                Add Row
              </button>
            </div>
            <div className="space-y-3">
              {formData.deliveries.map((row, index) => (
                <div key={`delivery-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={row.material}
                    onChange={(e) => updateDelivery(index, "material", e.target.value)}
                    placeholder="Material"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                  <input
                    value={row.status}
                    onChange={(e) => updateDelivery(index, "status", e.target.value)}
                    placeholder="Status"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-300 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-zinc-900">Delays</h2>
              <button
                type="button"
                onClick={addDelay}
                className="rounded-md border border-zinc-900 bg-white px-3 py-1 text-xs font-bold uppercase text-zinc-900"
              >
                Add Row
              </button>
            </div>
            <div className="space-y-3">
              {formData.delays.map((row, index) => (
                <div key={`delay-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={row.reason}
                    onChange={(e) => updateDelay(index, "reason", e.target.value)}
                    placeholder="Reason"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                  <input
                    value={row.duration}
                    onChange={(e) => updateDelay(index, "duration", e.target.value)}
                    placeholder="Duration"
                    className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-300 bg-zinc-50 p-4">
            <h2 className="text-lg font-black text-zinc-900">Safety Notes</h2>
            <textarea
              value={formData.safetyNotes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  safetyNotes: e.target.value,
                }))
              }
              placeholder="Safety observations, incidents, PPE compliance, etc."
              rows={5}
              className="mt-3 w-full rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
            />
          </section>
        </div>

        <aside className="rounded-xl border border-zinc-300 bg-zinc-50 p-4">
          <h2 className="text-lg font-black text-zinc-900">Transcript</h2>
          <p className="mt-3 max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-md border border-zinc-300 bg-white p-3 text-sm leading-relaxed text-zinc-700">
            {initialReport.transcriptText || "No transcript available."}
          </p>
        </aside>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={exportPdf}
          disabled={isGenerating}
          className="min-h-16 w-full rounded-xl border-2 border-black bg-emerald-600 px-4 py-3 text-lg font-black text-white shadow-[0_5px_0_#000] transition active:translate-y-[2px] active:shadow-[0_3px_0_#000] disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isGenerating ? "Generating PDF..." : "Export PDF"}
        </button>
      </div>
    </section>
  );
};
