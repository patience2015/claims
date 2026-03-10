import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { ExcelExportParams } from "@/types";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4F46E5" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const ROW_EVEN_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF3730A3" } },
    };
  });
  row.height = 24;
}

function styleDataRow(row: ExcelJS.Row, rowIndex: number) {
  if (rowIndex % 2 === 0) {
    row.eachCell((cell) => {
      cell.fill = ROW_EVEN_FILL;
    });
  }
  row.eachCell((cell) => {
    cell.alignment = { vertical: "middle" };
  });
  row.height = 20;
}

function setColumns(ws: ExcelJS.Worksheet, columns: { header: string; key: string; width: number }[]) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(ws.getRow(1));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.protect("claimflow-readonly", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });
}

function buildDateRange(params: ExcelExportParams): { dateFrom: Date; dateTo: Date; label: string } {
  const { period, year, month, quarter } = params;
  let dateFrom: Date;
  let dateTo: Date;
  let label: string;

  if (period === "month" && month) {
    dateFrom = new Date(year, month - 1, 1);
    dateTo = new Date(year, month, 0, 23, 59, 59);
    label = `${year}-${String(month).padStart(2, "0")}`;
  } else if (period === "quarter" && quarter) {
    const qMap: Record<string, [number, number]> = {
      Q1: [0, 2],
      Q2: [3, 5],
      Q3: [6, 8],
      Q4: [9, 11],
    };
    const [startMonth, endMonth] = qMap[quarter];
    dateFrom = new Date(year, startMonth, 1);
    dateTo = new Date(year, endMonth + 1, 0, 23, 59, 59);
    label = `${year}-${quarter}`;
  } else {
    dateFrom = new Date(year, 0, 1);
    dateTo = new Date(year, 11, 31, 23, 59, 59);
    label = String(year);
  }

  return { dateFrom, dateTo, label };
}

export async function generateComplianceXlsx(params: ExcelExportParams): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ClaimFlow AI";
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  const { dateFrom, dateTo, label } = buildDateRange(params);
  const claimTypeFilter = params.claimType !== "ALL" ? { type: params.claimType } : {};

  // ─── Sheet 1: Sinistres ────────────────────────────────────────────────────
  const wsSinistres = wb.addWorksheet("Sinistres");
  setColumns(wsSinistres, [
    { header: "N° Sinistre", key: "claimNumber", width: 18 },
    { header: "Statut", key: "status", width: 18 },
    { header: "Type", key: "type", width: 18 },
    { header: "Assuré", key: "policyholder", width: 24 },
    { header: "Date sinistre", key: "incidentDate", width: 16 },
    { header: "Montant estimé (€)", key: "estimatedAmount", width: 18 },
    { header: "Montant approuvé (€)", key: "approvedAmount", width: 20 },
    { header: "Score fraude", key: "fraudScore", width: 14 },
    { header: "Risque fraude", key: "fraudRisk", width: 14 },
    { header: "Créé le", key: "createdAt", width: 16 },
  ]);

  const claims = await prisma.claim.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      ...claimTypeFilter,
    },
    include: { policyholder: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  claims.forEach((c, idx) => {
    const row = wsSinistres.addRow({
      claimNumber: c.claimNumber,
      status: c.status,
      type: c.type,
      policyholder: `${c.policyholder.firstName} ${c.policyholder.lastName}`,
      incidentDate: c.incidentDate.toLocaleDateString("fr-FR"),
      estimatedAmount: c.estimatedAmount ?? 0,
      approvedAmount: c.approvedAmount ?? 0,
      fraudScore: c.fraudScore ?? "",
      fraudRisk: c.fraudRisk ?? "",
      createdAt: c.createdAt.toLocaleDateString("fr-FR"),
    });
    styleDataRow(row, idx + 2);
  });

  // ─── Sheet 2: Provisions SolvII ────────────────────────────────────────────
  const wsProvisions = wb.addWorksheet("Provisions SolvII");
  setColumns(wsProvisions, [
    { header: "Trimestre", key: "periodQuarter", width: 12 },
    { header: "N° Sinistre", key: "claimNumber", width: 18 },
    { header: "Best Estimate (€)", key: "bestEstimate", width: 20 },
    { header: "SCR (€)", key: "scr", width: 14 },
    { header: "Marge risque (€)", key: "riskMargin", width: 18 },
    { header: "Provision totale (€)", key: "totalProvision", width: 20 },
    { header: "Prob. résolution", key: "probabilityResolution", width: 18 },
    { header: "Statut", key: "status", width: 12 },
    { header: "Calculé le", key: "computedAt", width: 16 },
  ]);

  const provisions = await prisma.solvencyProvision.findMany({
    where: { computedAt: { gte: dateFrom, lte: dateTo } },
    include: { claim: { select: { claimNumber: true } } },
    orderBy: { computedAt: "desc" },
  });

  provisions.forEach((p, idx) => {
    const row = wsProvisions.addRow({
      periodQuarter: p.periodQuarter,
      claimNumber: p.claim.claimNumber,
      bestEstimate: p.bestEstimate,
      scr: p.scr,
      riskMargin: p.riskMargin,
      totalProvision: p.totalProvision,
      probabilityResolution: p.probabilityResolution,
      status: p.status,
      computedAt: p.computedAt.toLocaleDateString("fr-FR"),
    });
    styleDataRow(row, idx + 2);
  });

  // ─── Sheet 3: Fraude ───────────────────────────────────────────────────────
  const wsFraude = wb.addWorksheet("Fraude");
  setColumns(wsFraude, [
    { header: "N° Sinistre", key: "claimNumber", width: 18 },
    { header: "Score fraude", key: "fraudScore", width: 14 },
    { header: "Risque", key: "fraudRisk", width: 12 },
    { header: "Assuré", key: "policyholder", width: 24 },
    { header: "Type sinistre", key: "type", width: 18 },
    { header: "Montant estimé (€)", key: "estimatedAmount", width: 18 },
    { header: "Statut", key: "status", width: 16 },
    { header: "Date création", key: "createdAt", width: 16 },
  ]);

  const fraudClaims = await prisma.claim.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      fraudScore: { not: null },
      ...claimTypeFilter,
    },
    include: { policyholder: { select: { firstName: true, lastName: true } } },
    orderBy: { fraudScore: "desc" },
  });

  fraudClaims.forEach((c, idx) => {
    const row = wsFraude.addRow({
      claimNumber: c.claimNumber,
      fraudScore: c.fraudScore ?? 0,
      fraudRisk: c.fraudRisk ?? "",
      policyholder: `${c.policyholder.firstName} ${c.policyholder.lastName}`,
      type: c.type,
      estimatedAmount: c.estimatedAmount ?? 0,
      status: c.status,
      createdAt: c.createdAt.toLocaleDateString("fr-FR"),
    });
    styleDataRow(row, idx + 2);
  });

  // ─── Sheet 4: RGPD ─────────────────────────────────────────────────────────
  const wsRgpd = wb.addWorksheet("RGPD");
  setColumns(wsRgpd, [
    { header: "ID Demande", key: "id", width: 28 },
    { header: "ID Assuré", key: "policyholderId", width: 28 },
    { header: "Motif", key: "reason", width: 30 },
    { header: "Statut", key: "status", width: 14 },
    { header: "Demandé le", key: "requestedAt", width: 16 },
    { header: "Exécuté le", key: "executedAt", width: 16 },
  ]);

  const erasureRequests = await prisma.gdprErasureRequest.findMany({
    where: { requestedAt: { gte: dateFrom, lte: dateTo } },
    orderBy: { requestedAt: "desc" },
  });

  erasureRequests.forEach((r, idx) => {
    const meta = r.metadata ? (() => { try { return JSON.parse(r.metadata as string) as { reason?: string }; } catch { return {}; } })() : {};
    const row = wsRgpd.addRow({
      id: r.id,
      policyholderId: r.policyholderId,
      reason: meta.reason ?? "",
      status: r.status,
      requestedAt: r.requestedAt.toLocaleDateString("fr-FR"),
      executedAt: r.executedAt ? r.executedAt.toLocaleDateString("fr-FR") : "",
    });
    styleDataRow(row, idx + 2);
  });

  // ─── Sheet 5: Rapport SolvII ───────────────────────────────────────────────
  const wsSolvReport = wb.addWorksheet("Rapport SolvII");
  setColumns(wsSolvReport, [
    { header: "N° Rapport", key: "reportNumber", width: 18 },
    { header: "Trimestre", key: "periodQuarter", width: 12 },
    { header: "Total BE (€)", key: "totalBE", width: 16 },
    { header: "Total SCR (€)", key: "totalSCR", width: 16 },
    { header: "Total Marge Risque (€)", key: "totalRM", width: 22 },
    { header: "Total Provisions (€)", key: "totalProvisions", width: 20 },
    { header: "Nb sinistres", key: "claimCount", width: 14 },
    { header: "Généré le", key: "generatedAt", width: 16 },
  ]);

  const solvReports = await prisma.solvencyReport.findMany({
    where: { generatedAt: { gte: dateFrom, lte: dateTo } },
    orderBy: { generatedAt: "desc" },
  });

  solvReports.forEach((r, idx) => {
    const row = wsSolvReport.addRow({
      reportNumber: r.reportNumber,
      periodQuarter: r.periodQuarter,
      totalBE: r.totalBE,
      totalSCR: r.totalSCR,
      totalRM: r.totalRM,
      totalProvisions: r.totalProvisions,
      claimCount: r.claimCount,
      generatedAt: r.generatedAt.toLocaleDateString("fr-FR"),
    });
    styleDataRow(row, idx + 2);
  });

  // Metadata sheet title in all sheets
  for (const ws of [wsSinistres, wsProvisions, wsFraude, wsRgpd, wsSolvReport]) {
    ws.headerFooter.oddHeader = `&C&B ClaimFlow AI — Export conformité — Période : ${label}`;
    ws.headerFooter.oddFooter = "&C&8Confidentiel — Généré automatiquement le " + new Date().toLocaleDateString("fr-FR");
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
