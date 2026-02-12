import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ReportStatus } from "@prisma/client";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { Readable } from "stream";
import { z } from "zod";
import { getPrisma } from "./prisma";

const baseEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
});

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
});

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

const extractionSystemPrompt =
  "You are an expert Construction Foreman. Extract the following from the transcript into a valid JSON object: workPerformed (subcontractor, task, crewSize), deliveries (material, status), delays (reason, duration), and safetyNotes. If a field is not mentioned, return an empty array or null. Return ONLY raw JSON.";

const getMimeTypeFromKey = (fileKey: string): string => {
  const lower = fileKey.toLowerCase();
  if (lower.endsWith(".mp3") || lower.endsWith(".mpeg")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "audio/webm";
};

const getFileNameFromKey = (fileKey: string): string => {
  const rawName = fileKey.split("/").pop();
  if (!rawName) return "report.webm";
  return rawName;
};

const parseCrewSize = (value: number | string | null | undefined): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return null;
};

const normalizeExtracted = (payload: z.infer<typeof extractedSchema>) => ({
  workPerformed: payload.workPerformed.map((entry) => ({
    subcontractor: entry.subcontractor ?? null,
    task: entry.task ?? null,
    crewSize: parseCrewSize(entry.crewSize),
  })),
  deliveries: payload.deliveries.map((entry) => ({
    material: entry.material ?? null,
    status: entry.status ?? null,
  })),
  delays: payload.delays.map((entry) => ({
    reason: entry.reason ?? null,
    duration: entry.duration ?? null,
  })),
  safetyNotes: payload.safetyNotes ?? null,
});

const streamToBytes = async (stream: Readable): Promise<Uint8Array> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
};

const getR2Client = (env: z.infer<typeof r2EnvSchema>): S3Client =>
  new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

const getAudioBytesFromR2 = async (
  s3: S3Client,
  bucket: string,
  fileKey: string,
): Promise<Uint8Array> => {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    }),
  );

  if (!result.Body) {
    throw new Error(`No body returned from R2 for key: ${fileKey}`);
  }

  if ("transformToByteArray" in result.Body) {
    return result.Body.transformToByteArray();
  }

  if (result.Body instanceof Readable) {
    return streamToBytes(result.Body);
  }

  throw new Error("Unsupported R2 response body type.");
};

const parseJsonObject = (raw: string): unknown => {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Extraction output was not valid JSON.");
  }
};

const buildMarkdown = (
  reportId: string,
  transcriptText: string,
  extracted: ReturnType<typeof normalizeExtracted>,
): string => {
  const workRows = extracted.workPerformed
    .map(
      (row) =>
        `| ${row.subcontractor ?? ""} | ${row.task ?? ""} | ${
          row.crewSize !== null ? String(row.crewSize) : ""
        } |`,
    )
    .join("\n");

  const deliveryRows = extracted.deliveries
    .map((row) => `| ${row.material ?? ""} | ${row.status ?? ""} |`)
    .join("\n");

  const delayRows = extracted.delays
    .map((row) => `| ${row.reason ?? ""} | ${row.duration ?? ""} |`)
    .join("\n");

  return [
    "# DAILY CONSTRUCTION REPORT",
    "",
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
    extracted.safetyNotes ?? "None",
    "",
    "## Transcript",
    transcriptText,
  ].join("\n");
};

export type ProcessReportOptions = {
  transcriptOverride?: string;
};

export const processReport = async (
  reportId: string,
  options: ProcessReportOptions = {},
): Promise<void> => {
  const prisma = getPrisma();
  try {
    const baseEnv = baseEnvSchema.parse(process.env);
    const openai = new OpenAI({ apiKey: baseEnv.OPENAI_API_KEY });

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: { id: true, file_key: true },
    });

    if (!report) {
      throw new Error(`Report ${reportId} not found.`);
    }

    await prisma.dailyReport.update({
      where: { id: reportId },
      data: { status: ReportStatus.PROCESSING },
    });

    let transcriptText = options.transcriptOverride?.trim() ?? "";
    if (!transcriptText) {
      const r2Env = r2EnvSchema.parse(process.env);
      const s3 = getR2Client(r2Env);
      const audioBytes = await getAudioBytesFromR2(s3, r2Env.R2_BUCKET_NAME, report.file_key);
      const fileName = getFileNameFromKey(report.file_key);
      const mimeType = getMimeTypeFromKey(report.file_key);
      const audioFile = await toFile(audioBytes, fileName, { type: mimeType });

      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
      });
      transcriptText = transcription.text?.trim() ?? "";
    }

    if (!transcriptText) {
      throw new Error("Whisper returned an empty transcript.");
    }

    const extraction = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: extractionSystemPrompt },
        { role: "user", content: transcriptText },
      ],
    });

    const extractionText = extraction.choices[0]?.message?.content;
    if (!extractionText) {
      throw new Error("GPT extraction returned no content.");
    }

    const parsed = parseJsonObject(extractionText);
    const validated = extractedSchema.parse(parsed);
    const extractedJson = normalizeExtracted(validated);
    const markdownContent = buildMarkdown(report.id, transcriptText, extractedJson);

    await prisma.dailyReport.update({
      where: { id: reportId },
      data: {
        transcript_text: transcriptText,
        extracted_json: extractedJson,
        markdown_content: markdownContent,
        status: ReportStatus.READY,
      },
    });
  } catch (error) {
    try {
      await prisma.dailyReport.update({
        where: { id: reportId },
        data: { status: ReportStatus.FAILED },
      });
    } catch {
      // Intentionally swallow secondary failure when report is missing/unreachable.
    }

    throw error;
  }
};
