import { z } from "zod";

export enum ReportStatus {
  UPLOADING = "UPLOADING",
  DRAFT = "DRAFT",
  PROCESSING = "PROCESSING",
  READY = "READY",
  FAILED = "FAILED",
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface WorkEntry {
  id: string;
  daily_report_id: string;
  trade: string;
  description: string;
  location?: string | null;
  crew_count?: number | null;
  hours_worked?: number | null;
}

export interface Delivery {
  id: string;
  daily_report_id: string;
  vendor: string;
  material: string;
  quantity?: number | null;
  unit?: string | null;
  delivered_at?: string | null;
}

export interface Delay {
  id: string;
  daily_report_id: string;
  reason: string;
  impact_description: string;
  minutes_lost?: number | null;
  resolved: boolean;
}

export interface DailyReport {
  id: string;
  file_key: string;
  project_id: string;
  project_name: string;
  superintendent_name: string;
  report_date: string;
  status: ReportStatus;
  transcript_text: string;
  extracted_json: JsonValue | null;
  markdown_content: string;
  work_entries: WorkEntry[];
  deliveries: Delivery[];
  delays: Delay[];
  created_at: string;
  updated_at: string;
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const workEntrySchema: z.ZodType<WorkEntry> = z.object({
  id: z.string().uuid(),
  daily_report_id: z.string().uuid(),
  trade: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1).nullable().optional(),
  crew_count: z.number().int().nonnegative().nullable().optional(),
  hours_worked: z.number().nonnegative().nullable().optional(),
});

export const deliverySchema: z.ZodType<Delivery> = z.object({
  id: z.string().uuid(),
  daily_report_id: z.string().uuid(),
  vendor: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().min(1).nullable().optional(),
  delivered_at: z.string().datetime().nullable().optional(),
});

export const delaySchema: z.ZodType<Delay> = z.object({
  id: z.string().uuid(),
  daily_report_id: z.string().uuid(),
  reason: z.string().min(1),
  impact_description: z.string().min(1),
  minutes_lost: z.number().int().nonnegative().nullable().optional(),
  resolved: z.boolean(),
});

export const dailyReportSchema: z.ZodType<DailyReport> = z.object({
  id: z.string().uuid(),
  file_key: z.string().min(1),
  project_id: z.string().uuid(),
  project_name: z.string().min(1),
  superintendent_name: z.string().min(1),
  report_date: isoDateSchema,
  status: z.nativeEnum(ReportStatus),
  transcript_text: z.string(),
  extracted_json: jsonValueSchema.nullable(),
  markdown_content: z.string(),
  work_entries: z.array(workEntrySchema),
  deliveries: z.array(deliverySchema),
  delays: z.array(delaySchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
