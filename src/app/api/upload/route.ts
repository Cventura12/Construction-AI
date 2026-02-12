import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";

export const runtime = "nodejs";

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(255),
});

const envSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
});

const sanitizeFileName = (fileName: string): string =>
  fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);

const getS3Client = (env: z.infer<typeof envSchema>): S3Client =>
  new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

export const POST = async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsedBody = uploadRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid upload request payload.",
        details: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    return NextResponse.json(
      { error: "Server configuration is missing required R2 environment variables." },
      { status: 500 },
    );
  }

  const { fileName, fileType } = parsedBody.data;
  const safeFileName = sanitizeFileName(fileName) || "upload.bin";
  const fileKey = `audio/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeFileName}`;
  const s3Client = getS3Client(parsedEnv.data);

  try {
    const prisma = getPrisma();
    const report = await prisma.dailyReport.create({
      data: {
        file_key: fileKey,
        status: "UPLOADING",
        project_id: randomUUID(),
        project_name: "Pending",
        superintendent_name: "Pending",
        report_date: new Date(),
        transcript_text: "",
        extracted_json: {
          fileKey,
          fileType,
        },
        markdown_content: "",
      },
      select: { id: true },
    });

    const command = new PutObjectCommand({
      Bucket: parsedEnv.data.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 10,
    });

    return NextResponse.json(
      {
        signedUrl,
        reportId: report.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to create upload URL.", error);
    return NextResponse.json(
      { error: "Unable to create upload URL at this time." },
      { status: 500 },
    );
  }
};
