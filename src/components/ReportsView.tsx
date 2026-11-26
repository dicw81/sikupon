import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Coupon, CouponStatus, Distribution, FuelType } from '../types';
import {
  exportCouponsCsv,
  exportDistributionsCsv,
  formatDateID,
  formatNumber,
  formatRupiah,
  getTodayISO,
} from '../utils/formatters';
import { CouponStatusText } from './StatusText';

interface ReportsViewProps {
  coupons: Coupon[];
  distributions: Distribution[];
  staffName: string;
}

type ReportTab = 'official' | 'recipient' | 'serials';

export function ReportsView({
  coupons,
  distributions,
  staffName,
}: ReportsViewProps) {
  const [reportTab, setReportTab] = useState<ReportTab>('official');
  const [officialFilter, setOfficialFilter] = useState<string>('Semua');
  const [fuelFilter, setFuelFilter] = useState<'Semua' | FuelType>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | CouponStatus>('Semua');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const officialOptions = useMemo(() => {
    return Array.from(new Set(coupons.map((c) => c.receivedByOfficial))).sort();
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    return coupons
      .filter((c) => {
        if (officialFilter !== 'Semua' && c.receivedByOfficial !== officialFilter) {
          return false;
        }
        if (fuelFilter !== 'Semua' && c.fuelType !== fuelFilter) return false;
        if (statusFilter !== 'Semua' && c.status !== statusFilter) return false;
        const refDate = c.distributedDate || c.receivedDate;
        if (dateFrom && refDate < dateFrom) return false;
        if (dateTo && refDate > dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.batchCode !== b.batchCode) return a.batchCode.localeCompare(b.batchCode);
        return a.sequenceNumber - b.sequenceNumber;
      });
  }, [coupons, officialFilter, fuelFilter, statusFilter, dateFrom, dateTo]);

  const filteredDistributions = useMemo(() => {
    return distributions.filter((d) => {
      if (dateFrom && d.distributedDate < dateFrom) return false;
      if (dateTo && d.distributedDate > dateTo) return false;
      return true;
    });
  }, [distributions, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const active = filteredCoupons.filter((c) => c.status !== 'Dibatalkan');
    const available = filteredCoupons.filter((c) => c.status === 'Tersedia');
    const distributed = filteredCoupons.filter((c) => c.status === 'Dibagikan');
    const used = filteredCoupons.filter((c) => c.status === 'Terpakai');
    const cancelled = filteredCoupons.filter((c) => c.status === 'Dibatalkan');

    return {
      totalActive: active.length,
      availableCount: available.length,
      distributedCount: distributed.length,
      usedCount: used.length,
      cancelledCount: cancelled.length,
      totalNominal: active.reduce((s, c) => s + c.nominalValue, 0),
      distributedOrUsedNominal: [...distributed, ...used].reduce(
        (s, c) => s + c.nominalValue,
        0
      ),
      usedNominal: used.reduce((s, c) => s + c.nominalValue, 0),
      totalLiters: active.reduce((s, c) => s + c.litersPerCoupon, 0),
    };
  }, [filteredCoupons]);

  const officialFuelSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        official: string;
        fuelType: FuelType;
        total: number;
        available: number;
        distributed: number;
        used: number;
        cancelled: number;
        totalNominal: number;
        totalLiters: number;
      }
    >();

    for (const c of filteredCoupons) {
      const key = `${c.receivedByOfficial}__${c.fuelType}`;
      const row = map.get(key) || {
        key,
        official: c.receivedByOfficial,
        fuelType: c.fuelType,
        total: 0,
        available: 0,
        distributed: 0,
        used: 0,
        cancelled: 0,
        totalNominal: 0,
        totalLiters: 0,
      };
      row.total += 1;
      if (c.status !== 'Dibatalkan') {
        row.totalNominal += c.nominalValue;
        row.totalLiters += c.litersPerCoupon;
      }
      if (c.status === 'Tersedia') row.available += 1;
      if (c.status === 'Dibagikan') row.distributed += 1;
      if (c.status === 'Terpakai') row.used += 1;
      if (c.status === 'Dibatalkan') row.cancelled += 1;
      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.official.localeCompare(b.official)
    );
  }, [filteredCoupons]);

  const recipientSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        recipientName: string;
        recipientUnit: string;
        vehiclePlate: string;
        distributed: number;
        used: number;
        totalNominal: number;
        totalLiters: number;
      }
    >();

    for (const c of filteredCoupons) {
      if (!c.recipientName) continue;
      const key = `${c.recipientName}__${c.recipientUnit}__${c.vehiclePlate}`;
      const row = map.get(key) || {
        key,
        recipientName: c.recipientName,
        recipientUnit: c.recipientUnit || '-',
        vehiclePlate: c.vehiclePlate || '-',
        distributed: 0,
        used: 0,
        totalNominal: 0,
        totalLiters: 0,
      };
      if (c.status === 'Dibagikan') row.distributed += 1;
      if (c.status === 'Terpakai') row.used += 1;
      if (c.status === 'Dibagikan' || c.status === 'Terpakai') {
        row.totalNominal += c.nominalValue;
        row.totalLiters += c.litersPerCoupon;
      }
      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) => b.totalNominal - a.totalNominal);
  }, [filteredCoupons]);

  return (
    <div className="space-y-6">
      {/* Formal Print Header */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              LAPORAN PERTANGGUNGJAWABAN PENDATAAN &amp; PEMBAGIAN KUPON BBM
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Pejabat: {officialFilter} · Jenis BBM: {fuelFilter} · Status: {statusFilter}
              {(dateFrom || dateTo) &&
                ` · Periode: ${dateFrom ? formatDateID(dateFrom) : 'Awal'} s/d ${
                  dateTo ? formatDateID(dateTo) : 'Sekarang'
                }`}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Tanggal Cetak</div>
            <div className="font-mono font-semibold text-slate-900">
              {formatDateID(getTodayISO())}
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Export Toolbar */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Filter Laporan Pertanggungjawaban
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saring data berdasarkan pejabat, jenis BBM, status kupon, atau periode tanggal
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={filteredCoupons.length === 0}
              onClick={() => exportCouponsCsv(filteredCoupons)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh CSV Kupon
            </button>
            <button
              type="button"
              disabled={filteredDistributions.length === 0}
              onClick={() => exportDistributionsCsv(filteredDistributions)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh CSV BAST
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Laporan Resmi
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Pejabat Penerima</span>
            <select
              value={officialFilter}
              onChange={(e) => setOfficialFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="Semua">Semua Pejabat</option>
              {officialOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Jenis BBM</span>
            <select
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value as 'Semua' | FuelType)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="Semua">Semua Jenis</option>
              <option value="Pertamax">Pertamax</option>
              <option value="Pertalite">Pertalite</option>
              <option value="Dexlite">Dexlite</option>
              <option value="Solar">Solar</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Status Kupon</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'Semua' | CouponStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="Semua">Semua Status</option>
              <option value="Tersedia">Tersedia</option>
              <option value="Dibagikan">Dibagikan</option>
              <option value="Terpakai">Terpakai</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Dari Tanggal</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Sampai Tanggal</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </label>
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-reset">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Total Kupon Aktif</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-slate-900">
            {formatNumber(summary.totalActive)} lembar
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            {formatRupiah(summary.totalNominal)} · {formatNumber(summary.totalLiters)} L
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Sisa Tersedia</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-emerald-700">
            {formatNumber(summary.availableCount)} lembar
          </div>
          <div className="text-xs text-slate-500">Belum dibagikan</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Sedang Dibagikan</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-amber-700">
            {formatNumber(summary.distributedCount)} lembar
          </div>
          <div className="text-xs text-slate-500">Menunggu pelaporan nota</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Terpakai &amp; Sah Dilaporkan</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-blue-800">
            {formatNumber(summary.usedCount)} lembar
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            {formatRupiah(summary.usedNominal)}
          </div>
        </div>
      </div>

      {/* Report view switcher */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print-reset">
        <div className="no-print px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setReportTab('official')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                reportTab === 'official'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekap Pejabat &amp; Jenis BBM
            </button>
            <button
              type="button"
              onClick={() => setReportTab('recipient')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                reportTab === 'recipient'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekap Penerima &amp; Kendaraan
            </button>
            <button
              type="button"
              onClick={() => setReportTab('serials')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                reportTab === 'serials'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rincian Nomor Seri ({filteredCoupons.length})
            </button>
          </div>
        </div>

        {reportTab === 'official' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">Pejabat Penerima</th>
                  <th className="py-2.5 px-4 font-medium">Jenis BBM</th>
                  <th className="py-2.5 px-4 font-medium text-right">Diterima</th>
                  <th className="py-2.5 px-4 font-medium text-right">Tersedia</th>
                  <th className="py-2.5 px-4 font-medium text-right">Dibagikan</th>
                  <th className="py-2.5 px-4 font-medium text-right">Terpakai</th>
                  <th className="py-2.5 px-4 font-medium text-right">Batal</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Kuota</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officialFuelSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Tidak ada data untuk filter laporan ini.
                    </td>
                  </tr>
                ) : (
                  officialFuelSummary.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-slate-900">{r.official}</td>
                      <td className="py-3 px-4 text-slate-700">{r.fuelType}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {r.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {r.available}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                        {r.distributed}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-800">
                        {r.used}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700">
                        {r.cancelled}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {r.totalLiters} L
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatRupiah(r.totalNominal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'recipient' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">Nama Penerima</th>
                  <th className="py-2.5 px-4 font-medium">Unit / Bidang</th>
                  <th className="py-2.5 px-4 font-medium">No. Polisi</th>
                  <th className="py-2.5 px-4 font-medium text-right">Dibagikan</th>
                  <th className="py-2.5 px-4 font-medium text-right">Terpakai</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Kuota</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipientSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Belum ada kupon yang dibagikan pada filter ini.
                    </td>
                  </tr>
                ) : (
                  recipientSummary.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {r.recipientName}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{r.recipientUnit}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{r.vehiclePlate}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                        {r.distributed}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-800">
                        {r.used}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {r.totalLiters} L
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatRupiah(r.totalNominal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'serials' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">No. Seri</th>
                  <th className="py-2.5 px-4 font-medium">Pejabat Asal</th>
                  <th className="py-2.5 px-4 font-medium">BBM</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Penerima &amp; Plat</th>
                  <th className="py-2.5 px-4 font-medium">Tgl Bagi / Pakai</th>
                  <th className="py-2.5 px-4 font-medium">No. Struk</th>
                  <th className="py-2.5 px-4 font-medium text-right">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Tidak ada rincian nomor seri untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredCoupons.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {c.serialNumber}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{c.receivedByOfficial}</td>
                      <td className="py-2.5 px-4 text-slate-700">{c.fuelType}</td>
                      <td className="py-2.5 px-4">
                        <CouponStatusText status={c.status} />
                      </td>
                      <td className="py-2.5 px-4">
                        {c.recipientName ? (
                          <span>
                            {c.recipientName}
                            {c.vehiclePlate ? ` (${c.vehiclePlate})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                        {c.usedDate
                          ? formatDateID(c.usedDate)
                          : c.distributedDate
                            ? formatDateID(c.distributedDate)
                            : '-'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {c.receiptNumber || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatRupiah(c.nominalValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Signature Footer */}
      <div className="hidden print-only pt-10 grid grid-cols-2 gap-12 text-xs text-center">
        <div className="space-y-16">
          <div className="text-slate-600">Mengetahui, Pejabat Pengelola</div>
          <div className="border-t border-slate-400 pt-2 font-medium text-slate-900">
            {officialFilter !== 'Semua' ? officialFilter : 'Pejabat Penanggung Jawab'}
          </div>
        </div>
        <div className="space-y-16">
          <div className="text-slate-600">Disusun Oleh, Staf Distribusi</div>
          <div className="border-t border-slate-400 pt-2 font-medium text-slate-900">
            {staffName}
          </div>
        </div>
      </div>
    </div>
  );
}
