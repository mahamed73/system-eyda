"use client";

import { useEffect, useState } from "react";
import type { AttachmentWithUrl } from "@/lib/attachments/types";

const typeLabels: Record<string, string> = {
  xray: "أشعة",
  lab: "تحليل",
  prescription_scan: "صورة روشتة",
  other: "أخرى",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

interface AttachmentsSectionProps {
  visitId: string;
}

export default function AttachmentsSection({ visitId }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("other");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/visits/${visitId}/attachments`);
        const json = await res.json();
        if (!cancelled) setAttachments(json.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("اختار ملف الأول");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", fileType);

      const res = await fetch(`/api/visits/${visitId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر رفع الملف");
      setAttachments((prev) => [json.data, ...prev]);
      setFile(null);
      const input = document.getElementById("attachment-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("متأكد إنك عايز تحذف المرفق ده؟")) return;
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="font-semibold text-slate-800 mb-3">المرفقات الطبية (أشعة / تحاليل)</h2>

      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs text-slate-500 mb-1">الملف (JPG, PNG, WEBP, PDF)</label>
          <input
            id="attachment-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">تصوير مباشر بالكاميرا</label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
            📷 صوّر الآن
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </label>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">نوع المرفق</label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isUploading}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          {isUploading ? "جاري الرفع..." : "رفع الملف"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading && <p className="text-sm text-slate-400">جاري التحميل...</p>}

      {!loading && attachments.length === 0 && (
        <p className="text-sm text-slate-400">مفيش مرفقات لسه على الزيارة دي.</p>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {attachments.map((a) => (
          <div key={a.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <a href={a.download_url} target="_blank" rel="noreferrer">
              {isImage(a.mime_type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.download_url} alt={a.original_name ?? "مرفق"} className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
                  📄 PDF
                </div>
              )}
            </a>
            <div className="p-2">
              <p className="text-xs font-medium text-slate-700">{typeLabels[a.file_type ?? "other"]}</p>
              <p className="text-xs text-slate-400">{formatDate(a.uploaded_at)}</p>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
