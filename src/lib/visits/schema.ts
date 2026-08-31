import { z } from "zod";

export const paymentMethodEnum = z.enum(["cash", "vodafone_cash", "instapay", "other"]);

export const paymentInputSchema = z.object({
  amount: z.coerce.number().positive("المبلغ لازم يكون أكبر من صفر"),
  method: paymentMethodEnum.default("cash"),
});

export const visitInputSchema = z.object({
  patient_id: z.string().uuid("مريض غير صحيح"),
  doctor_id: z.string().uuid("طبيب غير صحيح"),
  appointment_id: z.string().uuid().nullable().optional(),
  diagnosis: z.string().trim().max(4000).nullable().optional(),
  prescription: z.string().trim().max(4000).nullable().optional(),
  price: z.coerce.number().min(0, "السعر لا يمكن أن يكون سالبًا").optional(),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ المتابعة لازم يكون بصيغة YYYY-MM-DD")
    .nullable()
    .optional(),
  initial_payment: paymentInputSchema.nullable().optional(),
});

export const visitUpdateSchema = z.object({
  diagnosis: z.string().trim().max(4000).nullable().optional(),
  prescription: z.string().trim().max(4000).nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ المتابعة لازم يكون بصيغة YYYY-MM-DD")
    .nullable()
    .optional(),
  follow_up_result: z.string().trim().max(4000).nullable().optional(),
  follow_up_completed: z.boolean().optional(),
});

export type VisitInput = z.infer<typeof visitInputSchema>;
export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
