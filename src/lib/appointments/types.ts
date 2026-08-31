export type AppointmentStatus = "booked" | "arrived" | "completed" | "no_show" | "cancelled";
export type VisitType = "checkup" | "follow_up";

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  visit_type: VisitType;
  price: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AppointmentWithNames extends Appointment {
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
}
