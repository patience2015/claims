import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { AcprMetrics } from "@/types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#4f46e5",
    borderBottomStyle: "solid",
    paddingBottom: 14,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#4f46e5",
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
  },
  metaBox: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 4,
    marginBottom: 20,
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    fontSize: 9,
    color: "#475569",
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginTop: 18,
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#4f46e5",
    borderLeftStyle: "solid",
  },
  table: {
    width: "100%",
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#4f46e5",
    padding: 6,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
  },
  tableRowEven: {
    backgroundColor: "#f8fafc",
  },
  tableCell: {
    fontSize: 9,
    flex: 1,
    color: "#334155",
  },
  tableCellValue: {
    fontSize: 9,
    flex: 1,
    color: "#1e293b",
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

interface PdfConfig {
  headerTitle: string;
  headerSubtitle?: string | null;
  footerText?: string | null;
}

function AcprDocument({
  metrics,
  config,
  reportNumber,
  periodLabel,
  periodStart,
  periodEnd,
}: {
  metrics: AcprMetrics;
  config: PdfConfig;
  reportNumber: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const generatedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document title={config.headerTitle} author="ClaimFlow AI">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{config.headerTitle}</Text>
          {config.headerSubtitle && (
            <Text style={styles.headerSubtitle}>{config.headerSubtitle}</Text>
          )}
        </View>

        {/* Métadonnées */}
        <View style={styles.metaBox}>
          <Text style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rapport : </Text>
            {reportNumber}
          </Text>
          <Text style={styles.metaItem}>
            <Text style={styles.metaLabel}>Période : </Text>
            {periodLabel}
          </Text>
          <Text style={styles.metaItem}>
            <Text style={styles.metaLabel}>Généré le : </Text>
            {generatedAt}
          </Text>
        </View>

        {/* Section 1 — Activité sinistres */}
        <Text style={styles.sectionTitle}>1. Activité Sinistres</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Indicateur</Text>
            <Text style={styles.tableHeaderCell}>Valeur</Text>
          </View>
          {[
            ["Sinistres ouverts (stock)", String(metrics.claimsOpened)],
            ["Sinistres clos sur la période", String(metrics.claimsClosed)],
            ["Nouveaux sinistres", String(metrics.claimsNew)],
            ["Délai moyen de traitement", `${metrics.avgProcessingDays.toFixed(1)} jours`],
          ].map(([label, value], i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
              <Text style={styles.tableCell}>{label}</Text>
              <Text style={styles.tableCellValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Section 2 — Provisions & Indemnités */}
        <Text style={styles.sectionTitle}>2. Provisions &amp; Indemnités</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Indicateur</Text>
            <Text style={styles.tableHeaderCell}>Montant</Text>
          </View>
          {[
            ["Total provisionné", formatEur(metrics.totalProvisioned)],
            ["Indemnités payées", formatEur(metrics.indemnitesPaid)],
            ["Indemnités en attente", formatEur(metrics.indemnitesWaiting)],
          ].map(([label, value], i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
              <Text style={styles.tableCell}>{label}</Text>
              <Text style={styles.tableCellValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Section 3 — Fraude & Conformité */}
        <Text style={styles.sectionTitle}>3. Fraude &amp; Conformité</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Indicateur</Text>
            <Text style={styles.tableHeaderCell}>Valeur</Text>
          </View>
          {[
            ["Taux de fraude détectée", `${metrics.fraudRate.toFixed(2)} %`],
            ["Ratio sinistres / primes", metrics.claimToPremiumRatio.toFixed(3)],
          ].map(([label, value], i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
              <Text style={styles.tableCell}>{label}</Text>
              <Text style={styles.tableCellValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {config.footerText ?? "Document confidentiel — Usage réglementaire uniquement"}
          </Text>
          <Text style={styles.footerText}>
            {periodStart.toLocaleDateString("fr-FR")} — {periodEnd.toLocaleDateString("fr-FR")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateAcprPdfBuffer(
  metrics: AcprMetrics,
  config: PdfConfig & { sections: string[] },
  reportNumber: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Buffer> {
  const periodLabel = periodStart.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const doc = (
    <AcprDocument
      metrics={metrics}
      config={config}
      reportNumber={reportNumber}
      periodLabel={periodLabel}
      periodStart={periodStart}
      periodEnd={periodEnd}
    />
  );

  return renderToBuffer(doc) as Promise<Buffer>;
}
