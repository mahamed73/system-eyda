export type AttachmentType = "xray" | "lab" | "prescription_scan" | "other";

export interface Attachment {
  id: string;
  visit_id: string;
  file_url: string;
  file_type: AttachmentType | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface AttachmentWithUrl extends Attachment {
  download_url: string;
}
