import { z } from "zod";

export const patientInputSchema = z.object({
  full_name: z.string().trim().min(2, "الاسم لازم يكون حرفين على الأقل").max(255),
  phone: z
    .string()
    .trim()
    .min(8, "رقم الهاتف غير صحيح")
    .max(20, "رقم الهاتف طويل جدًا")
    .regex(/^[0-9+\-\s]+$/, "رقم الهاتف يجب أن يحتوي أرقام فقط"),
  age: z
    .union([z.coerce.number().int().min(0).max(150), z.null()])
    .optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  allergies_notes: z.string().trim().max(2000).nullable().optional(),
  has_chronic_disease: z.boolean().nullable().optional(),
  blood_type: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .nullable()
    .optional(),
});

export const patientUpdateSchema = patientInputSchema.partial();

export type PatientInput = z.infer<typeof patientInputSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
