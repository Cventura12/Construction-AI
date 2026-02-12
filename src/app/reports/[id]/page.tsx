import { notFound } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { ReviewClient } from "./review-client";

type PageProps = {
  params: { id: string };
};

const extractedSchema = z.object({
  workPerformed: z
    .array(
      z.object({
        subcontractor: z.string().nullable().optional(),
        task: z.string().nullable().optional(),
        crewSize: z.union([z.number(), z.string()]).nullable().optional(),
      }),
    )
    .default([]),
  deliveries: z
    .array(
      z.object({
        material: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
      }),
    )
    .default([]),
  delays: z
    .array(
      z.object({
        reason: z.string().nullable().optional(),
        duration: z.string().nullable().optional(),
      }),
    )
    .default([]),
  safetyNotes: z.string().nullable().default(null),
});

const toStringOrEmpty = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const normalizeExtracted = (payload: z.infer<typeof extractedSchema>) => ({
  workPerformed: payload.workPerformed.map((entry) => ({
    subcontractor: toStringOrEmpty(entry.subcontractor),
    task: toStringOrEmpty(entry.task),
    crewSize: toStringOrEmpty(entry.crewSize),
  })),
  deliveries: payload.deliveries.map((entry) => ({
    material: toStringOrEmpty(entry.material),
    status: toStringOrEmpty(entry.status),
  })),
  delays: payload.delays.map((entry) => ({
    reason: toStringOrEmpty(entry.reason),
    duration: toStringOrEmpty(entry.duration),
  })),
  safetyNotes: toStringOrEmpty(payload.safetyNotes),
});

const formatDateForDisplay = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);

const ReportReviewPage = async ({ params }: PageProps) => {
  const prisma = getPrisma();
  const { id } = params;

  const report = await prisma.dailyReport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      project_name: true,
      report_date: true,
      extracted_json: true,
      transcript_text: true,
    },
  });

  if (!report) {
    notFound();
  }

  const parsedExtracted = extractedSchema.safeParse(report.extracted_json);
  const normalizedExtracted = normalizeExtracted(
    parsedExtracted.success ? parsedExtracted.data : extractedSchema.parse({}),
  );

  return (
    <main className="min-h-screen bg-zinc-200 p-4 sm:p-6">
      <ReviewClient
        initialReport={{
          id: report.id,
          status: report.status,
          projectName: report.project_name,
          reportDateISO: report.report_date.toISOString(),
          reportDateLabel: formatDateForDisplay(report.report_date),
          transcriptText: report.transcript_text ?? "",
          extracted: normalizedExtracted,
        }}
      />
    </main>
  );
};

export default ReportReviewPage;
