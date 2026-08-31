import { z } from "zod";

export const inventoryItemInputSchema = z.object({
  name: z.string().trim().min(2, "اسم الصنف لازم يكون حرفين على الأقل").max(255),
  quantity: z.coerce.number().int().min(0, "الكمية لا يمكن أن تكون سالبة").default(0),
  unit: z.string().trim().min(1).max(50).default("قطعة"),
  min_threshold: z.coerce.number().int().min(0).default(5),
  unit_price: z.coerce.number().min(0).nullable().optional(),
});

export const inventoryItemUpdateSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  min_threshold: z.coerce.number().int().min(0).optional(),
  unit_price: z.coerce.number().min(0).nullable().optional(),
});

export const inventoryMovementInputSchema = z.object({
  change_qty: z.coerce.number().int().refine((v) => v !== 0, "الكمية لازم تكون مختلفة عن صفر"),
  reason: z.string().trim().max(255).nullable().optional(),
});

export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>;
export type InventoryItemUpdateInput = z.infer<typeof inventoryItemUpdateSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementInputSchema>;
