import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSession } from "@/lib/api-auth";
import { getFullFinancialReport } from "@/lib/reports/queries";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

const methodLabels: Record<string, string> = {
  cash: "كاش",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  other: "أخرى",
};

function money(n: number) {
  return Number(Number(n).toFixed(2));
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 12 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF2FB" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

/**
 * GET /api/reports/export?format=xlsx&from=&to=
 * يصدّر التقرير المالي في ملف Excel حقيقي (.xlsx) بجداول عربية منسّقة
 * (اتجاه RTL) — أوراق: الملخص / الإيرادات / المصروفات.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, clinicName } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const defaults = defaultDateRange();
  const from = searchParams.get("from") ?? defaults.from;
  const to = searchParams.get("to") ?? defaults.to;

  const report = await getFullFinancialReport(clinicId, from, to);

  const wb = new ExcelJS.Workbook();
  wb.creator = clinicName;
  wb.created = new Date();

  // ============ ورقة 1: الملخص ============
  const summaryWs = wb.addWorksheet("الملخص", { views: [{ rightToLeft: true }] });
  summaryWs.columns = [{ width: 20 }, { width: 16 }, { width: 16 }, { width: 16 }];

  summaryWs.addRow([`تقرير مالي — ${clinicName}`]);
  summaryWs.addRow([`الفترة: من ${from} إلى ${to}`]);
  summaryWs.addRow([]);
  summaryWs.addRow(["إجمالي الإيرادات (ج.م)", money(report.totals.revenue)]);
  summaryWs.addRow(["إجمالي المصروفات (ج.م)", money(report.totals.expenses)]);
  summaryWs.addRow(["صافي الربح (ج.م)", money(report.totals.net)]);
  summaryWs.addRow([]);
  summaryWs.addRow(["التفاصيل اليومية"]);
  summaryWs.addRow(["اليوم", "الإيرادات (ج.م)", "المصروفات (ج.م)", "الصافي (ج.م)"]);

  for (const b of report.daily) {
    summaryWs.addRow([b.period_start, money(b.revenue), money(b.expenses), money(b.net)]);
  }

  summaryWs.mergeCells("A1:D1");
  summaryWs.getCell("A1").font = { bold: true, size: 14 };
  summaryWs.getCell("A1").alignment = { horizontal: "center" };
  summaryWs.getCell("A8").font = { bold: true };
  summaryWs.getRow(9).eachCell(applyHeaderStyle);
  for (let r = 4; r <= 6; r++) {
    summaryWs.getCell(`A${r}`).font = { bold: true };
  }

  // ============ ورقة 2: الإيرادات ============
  const revenueWs = wb.addWorksheet("الإيرادات", { views: [{ rightToLeft: true }] });
  revenueWs.columns = [{ width: 20 }, { width: 16 }];

  revenueWs.addRow(["توزيع الإيرادات حسب طريقة الدفع"]);
  revenueWs.addRow([]);
  revenueWs.addRow(["طريقة الدفع", "الإجمالي (ج.م)"]);
  for (const m of report.revenue.by_method) {
    revenueWs.addRow([methodLabels[m.method] ?? m.method, money(m.total)]);
  }
  revenueWs.addRow(["الإجمالي", money(report.revenue.total)]);

  revenueWs.addRow([]);
  revenueWs.addRow(["الإيرادات يوم بيوم"]);
  revenueWs.addRow([]);
  revenueWs.addRow(["اليوم", "الإجمالي (ج.م)"]);
  for (const d of report.revenue.by_day) {
    revenueWs.addRow([d.date, money(d.total)]);
  }

  revenueWs.getCell("A1").font = { bold: true, size: 13 };
  revenueWs.getRow(3).eachCell(applyHeaderStyle);
  revenueWs.getCell(`A${4 + report.revenue.by_method.length}`).font = { bold: true };
  const revenueDayHeader = revenueWs.rowCount - report.revenue.by_day.length;
  revenueWs.getRow(revenueDayHeader).eachCell(applyHeaderStyle);

  // ============ ورقة 3: المصروفات ============
  const expensesWs = wb.addWorksheet("المصروفات", { views: [{ rightToLeft: true }] });
  expensesWs.columns = [{ width: 20 }, { width: 16 }];

  expensesWs.addRow(["توزيع المصروفات حسب التصنيف"]);
  expensesWs.addRow([]);
  expensesWs.addRow(["التصنيف", "الإجمالي (ج.م)"]);
  for (const c of report.expenses.by_category) {
    expensesWs.addRow([c.category, money(c.total)]);
  }
  expensesWs.addRow(["الإجمالي", money(report.expenses.total)]);

  expensesWs.addRow([]);
  expensesWs.addRow(["المصروفات يوم بيوم"]);
  expensesWs.addRow([]);
  expensesWs.addRow(["اليوم", "الإجمالي (ج.م)"]);
  for (const d of report.expenses.by_day) {
    expensesWs.addRow([d.date, money(d.total)]);
  }

  expensesWs.getCell("A1").font = { bold: true, size: 13 };
  expensesWs.getRow(3).eachCell(applyHeaderStyle);
  expensesWs.getCell(`A${4 + report.expenses.by_category.length}`).font = { bold: true };
  const expensesDayHeader = expensesWs.rowCount - report.expenses.by_day.length;
  expensesWs.getRow(expensesDayHeader).eachCell(applyHeaderStyle);

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `financial-report-${from}-to-${to}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
