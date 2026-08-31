export type Gender = "male" | "female";

export interface Patient {
  id: string;
  clinic_id: string;
  full_name: string;
  phone: string;
  age: number | null;
  gender: Gender | null;
  address: string | null;
  allergies_notes: string | null;
  has_chronic_disease: boolean | null;
  blood_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientListItem extends Patient {
  last_visit_date: string | null;
  is_inactive: boolean;
}
