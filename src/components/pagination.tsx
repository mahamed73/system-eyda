"use client";

const PAGE_SIZES = [10, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** يرجّع أرقام الصفحات مع "..." للأجزاء البعيدة */
function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  const pages = new Set<number>([1, totalPages]);
  for (let i = page - 1; i <= page + 1; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

export default function Pagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalPages <= 1 && pageSize === 10) return null;

  const numbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5 text-sm">
      {/* اختيار عدد الصفوف */}
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-xs">عرض</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">من {total} سجل</span>
      </div>

      {/* أزرار التنقل */}
      <div className="flex items-center gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
        >
          السابق
        </button>

        {numbers.map((n, i) =>
          n === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`w-8 h-8 rounded-lg border text-center ${
                n === page
                  ? "bg-sky-600 text-white border-sky-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {n}
            </button>
          )
        )}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
