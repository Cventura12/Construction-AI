import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { processReport } from "@/lib/process-report";

export const runtime = "nodejs";

const requestSchema = z.object({
  reportId: z.string().min(1),
});

export const POST = async (request: Request) => {
  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { reportId } = parsed.data;

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    // Do not block the client; process asynchronously.
    void processReport(reportId).catch((error) => {
      console.error(`Background processing failed for report ${reportId}`, error);
    });

    return NextResponse.json({
      message: "Report processing started.",
      reportId,
    });
  } catch (error) {
    console.error("Failed to start report processing.", error);
    return NextResponse.json(
      { error: "Unable to start report processing." },
      { status: 500 },
    );
  }
};

