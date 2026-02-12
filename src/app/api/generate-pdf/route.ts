import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const payloadSchema = z.object({
  reportId: z.string().min(1),
  projectName: z.string().min(1),
  reportDate: z.string().min(1),
  transcriptText: z.string().optional().default(""),
  extractedJson: z.object({
    workPerformed: z
      .array(
        z.object({
          subcontractor: z.string().optional().default(""),
          task: z.string().optional().default(""),
          crewSize: z.string().optional().default(""),
        }),
      )
      .default([]),
    deliveries: z
      .array(
        z.object({
          material: z.string().optional().default(""),
          status: z.string().optional().default(""),
        }),
      )
      .default([]),
    delays: z
      .array(
        z.object({
          reason: z.string().optional().default(""),
          duration: z.string().optional().default(""),
        }),
      )
      .default([]),
    safetyNotes: z.string().optional().default(""),
  }),
});

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const rowOrDash = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? escapeHtml(trimmed) : "-";
};

const buildMarkdown = (payload: z.infer<typeof payloadSchema>): string => {
  const { projectName, reportDate, reportId, extractedJson } = payload;
  const dateLabel = new Date(reportDate).toLocaleDateString("en-US");

  const workRows = extractedJson.workPerformed
    .map((row) => `| ${row.subcontractor || ""} | ${row.task || ""} | ${row.crewSize || ""} |`)
    .join("\n");

  const deliveryRows = extractedJson.deliveries
    .map((row) => `| ${row.material || ""} | ${row.status || ""} |`)
    .join("\n");

  const delayRows = extractedJson.delays
    .map((row) => `| ${row.reason || ""} | ${row.duration || ""} |`)
    .join("\n");

  return [
    "# DAILY CONSTRUCTION REPORT",
    "",
    `- Project: ${projectName}`,
    `- Date: ${dateLabel}`,
    `- Report ID: ${reportId}`,
    "",
    "## Work Performed",
    "| Subcontractor | Task | Crew Size |",
    "| --- | --- | --- |",
    workRows || "| | | |",
    "",
    "## Deliveries",
    "| Material | Status |",
    "| --- | --- |",
    deliveryRows || "| | |",
    "",
    "## Delays",
    "| Reason | Duration |",
    "| --- | --- |",
    delayRows || "| | |",
    "",
    "## Safety Notes",
    extractedJson.safetyNotes || "None",
  ].join("\n");
};

const buildTableRows = (rows: string[][]): string =>
  rows
    .map(
      (columns) =>
        `<tr>${columns.map((column) => `<td>${rowOrDash(column)}</td>`).join("")}</tr>`,
    )
    .join("");

const buildHtml = (
  payload: z.infer<typeof payloadSchema>,
  markdownContent: string,
): string => {
  const dateLabel = new Date(payload.reportDate).toLocaleDateString("en-US");

  const workRows = payload.extractedJson.workPerformed.map((row) => [
    row.subcontractor,
    row.task,
    row.crewSize,
  ]);

  const deliveryRows = payload.extractedJson.deliveries.map((row) => [row.material, row.status]);
  const delayRows = payload.extractedJson.delays.map((row) => [row.reason, row.duration]);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Daily Construction Report</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #111827;
        margin: 24px;
      }
      .header {
        border-bottom: 2px solid #111827;
        padding-bottom: 8px;
        margin-bottom: 16px;
      }
      .title {
        font-size: 24px;
        font-weight: 800;
        margin: 0;
      }
      .meta {
        margin-top: 8px;
        font-size: 12px;
      }
      .meta p {
        margin: 2px 0;
      }
      h2 {
        margin: 20px 0 8px;
        font-size: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 8px;
        font-size: 12px;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        text-align: left;
      }
      .notes {
        border: 1px solid #d1d5db;
        padding: 10px;
        min-height: 64px;
        font-size: 12px;
      }
      .markdown {
        margin-top: 16px;
        padding: 10px;
        border: 1px dashed #9ca3af;
        background: #fafafa;
        font-size: 10px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <header class="header">
      <h1 class="title">DAILY CONSTRUCTION REPORT</h1>
      <div class="meta">
        <p><strong>Project:</strong> ${escapeHtml(payload.projectName)}</p>
        <p><strong>Date:</strong> ${escapeHtml(dateLabel)}</p>
        <p><strong>Report ID:</strong> ${escapeHtml(payload.reportId)}</p>
      </div>
    </header>

    <section>
      <h2>Work Performed</h2>
      <table>
        <thead>
          <tr>
            <th>Subcontractor</th>
            <th>Task</th>
            <th>Crew Size</th>
          </tr>
        </thead>
        <tbody>
          ${
            workRows.length > 0
              ? buildTableRows(workRows)
              : '<tr><td colspan="3">No work performed entries.</td></tr>'
          }
        </tbody>
      </table>
    </section>

    <section>
      <h2>Deliveries</h2>
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            deliveryRows.length > 0
              ? buildTableRows(deliveryRows)
              : '<tr><td colspan="2">No delivery entries.</td></tr>'
          }
        </tbody>
      </table>
    </section>

    <section>
      <h2>Delays</h2>
      <table>
        <thead>
          <tr>
            <th>Reason</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${delayRows.length > 0 ? buildTableRows(delayRows) : '<tr><td colspan="2">No delays listed.</td></tr>'}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Safety Notes</h2>
      <div class="notes">${rowOrDash(payload.extractedJson.safetyNotes)}</div>
    </section>

    <section>
      <div class="markdown"><strong>Source Markdown:</strong>\n${escapeHtml(markdownContent)}</div>
    </section>
  </body>
</html>`;
};

export const POST = async (request: Request) => {
  try {
    const rawBody = await request.json();
    const parsed = payloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROMIUM_PATH;
    if (!executablePath) {
      return NextResponse.json(
        {
          error:
            "PDF renderer is not configured. Set PUPPETEER_EXECUTABLE_PATH (or CHROMIUM_PATH).",
        },
        { status: 500 },
      );
    }

    const markdown = buildMarkdown(parsed.data);
    const html = buildHtml(parsed.data, markdown);

    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "Letter",
        printBackground: true,
        margin: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      });

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="daily-construction-report-${parsed.data.reportId}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Failed to generate PDF.", error);
    return NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 });
  }
};


