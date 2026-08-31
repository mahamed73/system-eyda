import { z } from "zod";

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: "تاريخ/وقت غير صحيح",
});

export const visitTypeEnum = z.enum(["checkup", "follow_up"]);

export const appointmentInputSchema = z.object({
  patient_id: z.string().uuid("مريض غير صحيح"),
  doctor_id: z.string().uuid("طبيب غير صحيح"),
  scheduled_at: isoDateTime,
  duration_minutes: z.coerce.number().int().min(5, "المدة قصيرة جدًا").max(240, "المدة طويلة جدًا").default(15),
  visit_type: visitTypeEnum.default("checkup"),
  price: z.coerce.number().min(0, "السعر لا يمكن أن يكون سالبًا").nullable().optional(),
  // تحديث اختياري لحالة "هل لدى المريض مرض مزمن؟" على ملف المريض نفسه،
  // بيتسأل وقت الحجز بس بيتخزن على المريض مش على الموعد.
  patient_has_chronic_disease: z.boolean().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const appointmentUpdateSchema = z.object({
  patient_id: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional(),
  scheduled_at: isoDateTime.optional(),
  duration_minutes: z.coerce.number().int().min(5).max(240).optional(),
  status: z.enum(["booked", "arrived", "in_consultation", "completed", "no_show", "cancelled"]).optional(),
  visit_type: visitTypeEnum.optional(),
  price: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;
export type AppointmentStatus =
  | "booked"
  | "arrived"
  | "in_consultation"
  | "completed"
  | "no_show"
  | "cancelled";
export type VisitType = "checkup" | "follow_up";
