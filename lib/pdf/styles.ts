import { StyleSheet } from '@react-pdf/renderer'

export const PDF_COLORS = {
  navy: '#0f172a',
  navyMid: '#1e3a5f',
  blue: '#3b82f6',
  lightBlue: '#dbeafe',
  white: '#ffffff',
  offWhite: '#f8fafc',
  gray100: '#f1f5f9',
  gray400: '#94a3b8',
  gray600: '#64748b',
  gray900: '#111827',
  green: '#16a34a',
  greenLight: '#dcfce7',
  red: '#dc2626',
  redLight: '#fee2e2',
  amber: '#d97706',
  amberLight: '#fef9c3',
}

export const pdfStyles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: '#ffffff', padding: 40 },
  coverPage: { fontFamily: 'Helvetica', backgroundColor: '#0f172a', padding: 60, justifyContent: 'center' },
  coverTitle: { fontSize: 42, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 12 },
  coverSubtitle: { fontSize: 18, color: '#94a3b8', marginBottom: 48 },
  coverDivider: { height: 2, backgroundColor: '#3b82f6', marginBottom: 40, width: 60 },
  coverMetricRow: { flexDirection: 'row', marginBottom: 16 },
  coverMetricLabel: { fontSize: 12, color: '#64748b', width: 200 },
  coverMetricValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  coverDate: { position: 'absolute', bottom: 60, left: 60, fontSize: 11, color: '#475569' },
  coverFooter: { position: 'absolute', bottom: 60, right: 60, fontSize: 11, color: '#475569' },
  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#0f172a', borderBottomStyle: 'solid',
  },
  pageHeaderTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  pageHeaderLogo: { fontSize: 11, color: '#94a3b8', fontFamily: 'Helvetica-Oblique' },
  sectionHeader: {
    fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a',
    marginBottom: 8, marginTop: 20, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', borderBottomStyle: 'solid',
  },
  sectionSubheader: { fontSize: 10, color: '#64748b', marginBottom: 12, marginTop: -4 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metricCard: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: 14,
    borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6',
  },
  metricCardGreen: { borderLeftColor: '#16a34a' },
  metricCardRed: { borderLeftColor: '#dc2626' },
  metricCardAmber: { borderLeftColor: '#d97706' },
  metricLabel: { fontSize: 9, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  metricSub: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  table: { marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 8, borderRadius: 4, marginBottom: 1 },
  tableHeaderCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', flex: 1 },
  tableHeaderCellRight: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', flex: 1, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid',
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableRowTotal: { backgroundColor: '#0f172a', borderRadius: 4, marginTop: 2 },
  tableCell: { fontSize: 10, color: '#374151', flex: 1 },
  tableCellRight: { fontSize: 10, color: '#374151', flex: 1, textAlign: 'right' },
  tableCellTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff', flex: 1 },
  tableCellTotal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff', flex: 1, textAlign: 'right' },
  tableCellGreen: { color: '#16a34a', fontFamily: 'Helvetica-Bold' },
  tableCellRed: { color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  twoCol: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  col: { flex: 1 },
  infoBox: {
    backgroundColor: '#dbeafe', borderRadius: 6, padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#3b82f6', borderLeftStyle: 'solid',
  },
  infoBoxText: { fontSize: 10, color: '#1e3a5f', lineHeight: 1.5 },
  warningBox: {
    backgroundColor: '#fef9c3', borderRadius: 6, padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#d97706', borderLeftStyle: 'solid',
  },
  warningBoxText: { fontSize: 10, color: '#92400e', lineHeight: 1.5 },
  successBox: {
    backgroundColor: '#dcfce7', borderRadius: 6, padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#16a34a', borderLeftStyle: 'solid',
  },
  successBoxText: { fontSize: 10, color: '#14532d', lineHeight: 1.5 },
  priorityCard: {
    flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 6, padding: 12, marginBottom: 8, alignItems: 'flex-start',
  },
  priorityNumber: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#0f172a',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0,
  },
  priorityNumberText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  priorityContent: { flex: 1 },
  priorityTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3 },
  priorityDesc: { fontSize: 10, color: '#64748b', lineHeight: 1.4 },
  barChartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { fontSize: 9, color: '#64748b', width: 100 },
  barTrack: { flex: 1, height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, marginHorizontal: 8 },
  barFill: { height: 12, backgroundColor: '#3b82f6', borderRadius: 6 },
  barValue: { fontSize: 9, color: '#374151', width: 60, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  waterfallRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid',
  },
  waterfallLabel: { fontSize: 10, color: '#374151', width: 180 },
  waterfallBar: { flex: 1, height: 16, borderRadius: 4, marginHorizontal: 8 },
  waterfallValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 80, textAlign: 'right' },
  pageFooter: {
    position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#e2e8f0', borderTopStyle: 'solid', paddingTop: 8,
  },
  footerText: { fontSize: 8, color: '#94a3b8' },
  bodyText: { fontSize: 10, color: '#374151', lineHeight: 1.6, marginBottom: 8 },
  boldText: { fontFamily: 'Helvetica-Bold' },
  smallText: { fontSize: 9, color: '#64748b' },
  spacer: { height: 12 },
  spacerLg: { height: 24 },
})

export function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1000000) return `$${(n/1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `$${Math.round(n).toLocaleString()}`
  return `$${n.toFixed(0)}`
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

