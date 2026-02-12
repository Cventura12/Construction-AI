"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileDown, HardHat, Share2 } from "lucide-react";

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
    markdownContent: string;
    extracted: ExtractedData;
  };
};

export const ReviewClient = ({ initialReport }: ReviewClientProps) => {
  const router = useRouter();
  const [formData, setFormData] = useState<ExtractedData>(initialReport.extracted);
  const [markdownContent, setMarkdownContent] = useState(initialReport.markdownContent || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

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
    setMarkdownContent(initialReport.markdownContent || "");
  }, [initialReport.extracted, initialReport.id, initialReport.status]);

  const statusClasses: Record<ReviewClientProps["initialReport"]["status"], string> = {
    PROCESSING: "border-amber-300 bg-amber-100 text-amber-900",
    READY: "border-emerald-300 bg-emerald-100 text-emerald-900",
    FAILED: "border-red-300 bg-red-100 text-red-900",
    DRAFT: "border-slate-300 bg-slate-100 text-slate-800",
    UPLOADING: "border-amber-300 bg-amber-100 text-amber-900",
  };

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const manpowerRows = useMemo(
    () =>
      formData.workPerformed
        .map((entry) => ({
          trade: entry.subcontractor || entry.task || "",
          count: entry.crewSize || "",
          hours: "",
          notes: entry.task || "",
        }))
        .filter((row) => row.trade || row.count || row.notes),
    [formData.workPerformed],
  );

  const exportPdf = async () => {
    setError(null);
    setShareMessage(null);
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
          markdownContent,
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

  const shareLink = async () => {
    setError(null);
    setShareMessage(null);

    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({
          title: "Daily Construction Report",
          text: `Report ${initialReport.id}`,
          url,
        });
        setShareMessage("Link shared.");
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareMessage("Link copied to clipboard.");
    } catch {
      setError("Could not share link. Try again.");
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl pb-28">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            Daily Construction Report
          </h1>
          <span
            className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-extrabold uppercase ${statusClasses[initialReport.status]}`}
          >
            {initialReport.status}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <HardHat className="h-4 w-4 text-hammer-orange" />
            Project: {initialReport.projectName || "Chattanooga Site A"}
          </p>
          <p className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-hammer-orange" />
            Date: {dateLabel}
          </p>
        </div>
      </header>

      {isProcessing ? (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
          <h2 className="mt-4 text-xl font-black uppercase text-slate-900">Processing...</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            AI is transcribing and structuring your report.
          </p>
        </section>
      ) : null}

      {initialReport.status === "FAILED" ? (
        <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Processing failed. Please re-record or retry processing.
          </p>
        </section>
      ) : null}

      {!isProcessing ? (
        <div className="mt-4 space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
              Markdown Review
            </h2>
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              rows={14}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 font-sans text-sm leading-relaxed text-slate-800"
              placeholder="Edit the report markdown here..."
            />
          </section>

          {manpowerRows.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-900">
                Manpower Summary
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Trade</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manpowerRows.map((row, index) => (
                      <tr
                        key={`${row.trade}-${index}`}
                        className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                      >
                        <td className="px-4 py-3 font-semibold">{row.trade || "-"}</td>
                        <td className="px-4 py-3">{row.count || "-"}</td>
                        <td className="px-4 py-3">{row.hours || "-"}</td>
                        <td className="px-4 py-3">{row.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      {shareMessage ? (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {shareMessage}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white/95 px-2 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={exportPdf}
            disabled={isGenerating || isProcessing || initialReport.status === "FAILED"}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-hammer-orange px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {isGenerating ? "Generating PDF..." : "Generate & Export PDF"}
          </button>
        <button
          type="button"
            onClick={shareLink}
            disabled={isGenerating}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <Share2 className="h-4 w-4" />
            Share Link
        </button>
        </div>
      </div>
    </section>
  );
};
