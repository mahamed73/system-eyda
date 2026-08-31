export interface Expense {
  id: string;
  clinic_id: string;
  description: string;
  category: string | null;
  amount: string;
  expense_date: string;
  created_by: string | null;
  created_at: string;
}
