import { z } from "zod";

export const expenseInputSchema = z.object({
  description: z.string().trim().min(2, "الوصف لازم يكون حرفين على الأقل").max(255),
  category: z.string().trim().max(50).nullable().optional(),
  amount: z.coerce.number().positive("المبلغ لازم يكون أكبر من صفر"),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ لازم يكون بصيغة YYYY-MM-DD")
    .optional(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
