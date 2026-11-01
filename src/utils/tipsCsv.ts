/** CSV for the Tips tab download. Opens cleanly in Excel and Google Sheets, and cannot run formulas. */

export interface CsvTip {
  amount: number
  status: string
  createdAt: string
  fees: number
  youKeep: number
  reason?: string | null
}

export const statusLabel = (status: string) => (status === 'processed' ? 'Charged' : status === 'pending' ? 'Waiting' : 'Not charged')

/** Quotes a cell when needed, and defuses text a spreadsheet would run as a formula (=, +, -, @). */
export const csvCell = (value: string | number): string => {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const two = (n: number) => n.toFixed(2)
const pad = (n: number) => String(n).padStart(2, '0')
const localStamp = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const CSV_HEADERS = ['Date and time', 'Device', 'Tip (gross)', 'Status', 'Fees', 'You keep', 'Note']

export function buildTipsCsv(tips: (CsvTip & { deviceName: string })[]): string {
  const lines = [CSV_HEADERS.map(csvCell).join(',')]
  for (const t of tips) {
    const charged = t.status !== 'pending' && t.status !== 'failed'
    lines.push(
      [
        localStamp(t.createdAt),
        t.deviceName,
        two(t.amount),
        statusLabel(t.status),
        charged ? two(t.fees) : '',
        charged ? two(t.youKeep) : '',
        t.reason ?? (t.status === 'pending' ? 'Charged in the next batch' : '')
      ]
        .map(csvCell)
        .join(',')
    )
  }
  // The byte-order mark makes Excel read the file as UTF-8
  return '﻿' + lines.join('\r\n') + '\r\n'
}
