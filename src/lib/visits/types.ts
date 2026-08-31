export type PaymentMethod = "cash" | "vodafone_cash" | "instapay" | "other";

export interface Payment {
  id: string;
  visit_id: string;
  amount: string;
  method: PaymentMethod | null;
  paid_at: string;
}

export interface Visit {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  doctor_id: string;
  visit_date: string;
  diagnosis: string | null;
  prescription: string | null;
  price: string;
  follow_up_date: string | null;
  created_at: string;
}

export interface VisitWithDetails extends Visit {
  doctor_name: string;
  patient_name?: string;
  patient_phone?: string;
  payments: Payment[];
  total_paid: number;
  remaining_balance: number;
}
