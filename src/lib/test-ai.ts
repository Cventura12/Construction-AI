import { randomUUID } from "crypto";
import { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { processReport } from "./process-report";

const SAMPLE_TRANSCRIPT =
  "Today is Feb 12th. We had 4 guys from Southern Masonry laying brick on the north wall. No safety issues. Concrete delivery was 2 hours late because of traffic on I-24.";

const assertOrThrow = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run this test.");
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to run this test.");
  }

  const testReport = await prisma.dailyReport.create({
    data: {
      file_key: `test/mock-${Date.now()}-${randomUUID()}.webm`,
      status: ReportStatus.UPLOADING,
      project_id: randomUUID(),
      project_name: "HammerVoice Test Project",
      superintendent_name: "Test Superintendent",
      report_date: new Date("2026-02-12T12:00:00.000Z"),
      transcript_text: "",
      extracted_json: null,
      markdown_content: "",
    },
    select: { id: true },
  });

  console.log(`[test-ai] Created report: ${testReport.id}`);

  await processReport(testReport.id, {
    transcriptOverride: SAMPLE_TRANSCRIPT,
  });

  const updated = await prisma.dailyReport.findUnique({
    where: { id: testReport.id },
    select: {
      id: true,
      status: true,
      transcript_text: true,
      extracted_json: true,
      markdown_content: true,
    },
  });

  assertOrThrow(Boolean(updated), "Updated report not found.");
  assertOrThrow(updated!.status === ReportStatus.READY, "Expected report status READY.");

  const extracted = (updated!.extracted_json ?? {}) as {
    workPerformed?: Array<{
      subcontractor?: string | null;
      task?: string | null;
      crewSize?: number | null;
    }>;
  };

  const workPerformed = Array.isArray(extracted.workPerformed) ? extracted.workPerformed : [];
  const hasSouthernMasonry = workPerformed.some((row) =>
    (row.subcontractor ?? "").toLowerCase().includes("southern masonry"),
  );
  const hasCrewSizeFour = workPerformed.some((row) => row.crewSize === 4);

  assertOrThrow(
    hasSouthernMasonry,
    "Expected extracted_json.workPerformed to include subcontractor 'Southern Masonry'.",
  );
  assertOrThrow(
    hasCrewSizeFour,
    "Expected extracted_json.workPerformed to include crewSize = 4.",
  );

  assertOrThrow(
    updated!.markdown_content.includes("DAILY CONSTRUCTION REPORT"),
    "Expected markdown_content to include report header.",
  );
  assertOrThrow(
    updated!.markdown_content.toLowerCase().includes("southern masonry"),
    "Expected markdown_content to include Southern Masonry.",
  );

  console.log("[test-ai] PASS: AI extraction and markdown update verified.");
  console.log(`[test-ai] Report ID for UI/PDF stress test: ${updated!.id}`);
};

main()
  .catch((error) => {
    console.error("[test-ai] FAIL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // No-op when Prisma was never initialized.
    }
  });
