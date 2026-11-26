import { Coupon, Distribution } from '../types';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatDateID(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '-';
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildSerialNumber(prefix: string, seq: number, padLength = 4): string {
  const cleanPrefix = prefix.trim();
  const padded = String(seq).padStart(padLength, '0');
  return `${cleanPrefix}${padded}`;
}

export function summarizeSerials(coupons: Coupon[]): string {
  if (coupons.length === 0) return '-';
  const sorted = [...coupons].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  if (sorted.length === 1) return sorted[0].serialNumber;
  const first = sorted[0].serialNumber;
  const last = sorted[sorted.length - 1].serialNumber;
  const summary = `${first} s/d ${last} (${sorted.length} lembar)`;
  return summary.slice(0, 200);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(filename: string, csvContent: string): void {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportCouponsCsv(coupons: Coupon[], filenamePrefix = 'laporan-kupon-bbm'): void {
  const headers = [
    'Nomor Seri Kupon',
    'Kode Batch',
    'Jenis BBM',
    'Nilai Nominal (Rp)',
    'Kuota (Liter)',
    'Pejabat Penerima',
    'Tanggal Terima Batch',
    'Status Kupon',
    'Nama Penerima',
    'Unit / Bidang',
    'No. Polisi Kendaraan',
    'Staf Pembagi',
    'Tanggal Pembagian',
    'Tanggal Terpakai',
    'No. Struk / Nota SPBU',
  ];

  const rows = coupons.map((c) =>
    [
      c.serialNumber,
      c.batchCode,
      c.fuelType,
      c.nominalValue,
      c.litersPerCoupon,
      c.receivedByOfficial,
      c.receivedDate,
      c.status,
      c.recipientName || '-',
      c.recipientUnit || '-',
      c.vehiclePlate || '-',
      c.distributedByName || '-',
      c.distributedDate || '-',
      c.usedDate || '-',
      c.receiptNumber || '-',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
  triggerCsvDownload(`${filenamePrefix}-${getTodayISO()}.csv`, csv);
}

export function exportDistributionsCsv(
  distributions: Distribution[],
  filenamePrefix = 'berita-acara-pembagian-bbm'
): void {
  const headers = [
    'Nomor BAST',
    'Tanggal Pembagian',
    'Nama Penerima',
    'Unit / Bidang',
    'No. Polisi Kendaraan',
    'Keperluan',
    'Staf Pembagi',
    'Jumlah Kupon',
    'Ringkasan Nomor Seri',
    'Total Nilai (Rp)',
    'Total Kuota (Liter)',
    'Status',
    'Catatan',
  ];

  const rows = distributions.map((d) =>
    [
      d.handoverNumber,
      d.distributedDate,
      d.recipientName,
      d.recipientUnit,
      d.vehiclePlate || '-',
      d.purpose,
      d.distributedByName,
      d.couponCount,
      d.serialSummary,
      d.totalNominal,
      d.totalLiters,
      d.status,
      d.notes || '-',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
  triggerCsvDownload(`${filenamePrefix}-${getTodayISO()}.csv`, csv);
}
