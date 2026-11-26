import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { cancelCoupon, returnCouponToStock } from '../services/couponService';
import { Coupon, CouponBatch, CouponStatus, FuelType } from '../types';
import { formatDateID, formatRupiah } from '../utils/formatters';
import { MarkUsedModal } from './MarkUsedModal';
import { CouponStatusText } from './StatusText';

interface InventoryViewProps {
  batches: CouponBatch[];
  coupons: Coupon[];
  onOpenBatchModal: () => void;
}

const STATUS_FILTERS: Array<'Semua' | CouponStatus> = [
  'Semua',
  'Tersedia',
  'Dibagikan',
  'Terpakai',
  'Dibatalkan',
];

export function InventoryView({
  batches,
  coupons,
  onOpenBatchModal,
}: InventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | CouponStatus>('Semua');
  const [fuelFilter, setFuelFilter] = useState<'Semua' | FuelType>('Semua');
  const [batchFilter, setBatchFilter] = useState<string>('Semua');
  const [reportingCoupon, setReportingCoupon] = useState<Coupon | null>(null);
  const [busyCouponId, setBusyCouponId] = useState<string | null>(null);

  const batchStats = useMemo(() => {
    const map = new Map<
      string,
      { available: number; distributed: number; used: number; cancelled: number }
    >();
    for (const c of coupons) {
      const entry = map.get(c.batchId) || {
        available: 0,
        distributed: 0,
        used: 0,
        cancelled: 0,
      };
      if (c.status === 'Tersedia') entry.available += 1;
      if (c.status === 'Dibagikan') entry.distributed += 1;
      if (c.status === 'Terpakai') entry.used += 1;
      if (c.status === 'Dibatalkan') entry.cancelled += 1;
      map.set(c.batchId, entry);
    }
    return map;
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return coupons
      .filter((c) => {
        if (statusFilter !== 'Semua' && c.status !== statusFilter) return false;
        if (fuelFilter !== 'Semua' && c.fuelType !== fuelFilter) return false;
        if (batchFilter !== 'Semua' && c.batchId !== batchFilter) return false;
        if (q) {
          const hay = [
            c.serialNumber,
            c.batchCode,
            c.receivedByOfficial,
            c.recipientName,
            c.recipientUnit,
            c.vehiclePlate,
            c.receiptNumber,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.batchCode !== b.batchCode) return a.batchCode.localeCompare(b.batchCode);
        return a.sequenceNumber - b.sequenceNumber;
      });
  }, [coupons, searchQuery, statusFilter, fuelFilter, batchFilter]);

  const handleReturn = async (coupon: Coupon) => {
    setBusyCouponId(coupon.id);
    try {
      await returnCouponToStock(coupon.id);
    } finally {
      setBusyCouponId(null);
    }
  };

  const handleCancel = async (coupon: Coupon) => {
    setBusyCouponId(coupon.id);
    try {
      await cancelCoupon(coupon.id);
    } finally {
      setBusyCouponId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch summary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Batch Penerimaan Kupon Terdaftar
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap batch kupon yang diterima pejabat didata terlebih dahulu sebelum dibagikan
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBatchModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Catat Batch Kupon Baru
          </button>
        </div>

        {batches.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada batch kupon terdaftar. Klik tombol Catat Batch Kupon Baru untuk memulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">Kode Batch &amp; Sumber</th>
                  <th className="py-2.5 px-4 font-medium">Pejabat Penerima</th>
                  <th className="py-2.5 px-4 font-medium">Tgl Terima</th>
                  <th className="py-2.5 px-4 font-medium">Jenis BBM</th>
                  <th className="py-2.5 px-4 font-medium">Rentang Seri</th>
                  <th className="py-2.5 px-4 font-medium text-right">Tersedia / Total</th>
                  <th className="py-2.5 px-4 font-medium text-right">Nilai per Kupon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => {
                  const st = batchStats.get(b.id) || {
                    available: 0,
                    distributed: 0,
                    used: 0,
                    cancelled: 0,
                  };
                  return (
                    <tr
                      key={b.id}
                      onClick={() =>
                        setBatchFilter((prev) => (prev === b.id ? 'Semua' : b.id))
                      }
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        batchFilter === b.id ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium text-slate-900">
                          {b.batchCode}
                        </span>
                        <span className="block text-[11px] text-slate-500">{b.source}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {b.receivedByOfficial}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                        {formatDateID(b.receivedDate)}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {b.fuelType} · {b.litersPerCoupon} L
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {b.prefix}
                        {String(b.startNumber).padStart(4, '0')} –{' '}
                        {String(b.endNumber).padStart(4, '0')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="text-emerald-700 font-semibold">{st.available}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-slate-800">{b.totalCount}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatRupiah(b.nominalValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual coupon serial registry */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Daftar Rinci Nomor Seri Kupon ({filteredCoupons.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pelacakan status tiap lembar kupon hingga pelaporan nota SPBU
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor seri, pejabat, penerima, plat kendaraan, atau no. struk..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={fuelFilter}
                onChange={(e) => setFuelFilter(e.target.value as 'Semua' | FuelType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              >
                <option value="Semua">Semua Jenis BBM</option>
                <option value="Pertamax">Pertamax</option>
                <option value="Pertalite">Pertalite</option>
                <option value="Dexlite">Dexlite</option>
                <option value="Solar">Solar</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              >
                <option value="Semua">Semua Batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchCode}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Tidak ada kupon yang sesuai dengan filter pencarian saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">Nomor Seri</th>
                  <th className="py-2.5 px-4 font-medium">Jenis &amp; Nilai</th>
                  <th className="py-2.5 px-4 font-medium">Pejabat Asal</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Penerima &amp; Kendaraan</th>
                  <th className="py-2.5 px-4 font-medium">Pelaporan / Struk</th>
                  <th className="py-2.5 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCoupons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-semibold text-slate-900">
                        {c.serialNumber}
                      </span>
                      <span className="block text-[11px] font-mono text-slate-500">
                        {c.batchCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-slate-900 font-medium">{c.fuelType}</span>
                      <span className="block text-[11px] font-mono tabular-nums text-slate-500">
                        {formatRupiah(c.nominalValue)} · {c.litersPerCoupon} L
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{c.receivedByOfficial}</td>
                    <td className="py-2.5 px-4">
                      <CouponStatusText status={c.status} />
                    </td>
                    <td className="py-2.5 px-4">
                      {c.recipientName ? (
                        <div>
                          <span className="font-medium text-slate-900">
                            {c.recipientName}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {c.recipientUnit}
                            {c.vehiclePlate ? ` · ${c.vehiclePlate}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Belum dibagikan</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {c.status === 'Terpakai' ? (
                        <div>
                          <span className="font-mono text-slate-900">
                            {c.receiptNumber || '-'}
                          </span>
                          <span className="block text-[11px] font-mono text-slate-500">
                            {formatDateID(c.usedDate)}
                          </span>
                        </div>
                      ) : c.distributedDate ? (
                        <span className="text-[11px] font-mono text-slate-500">
                          Dibagi {formatDateID(c.distributedDate)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {c.status === 'Dibagikan' && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyCouponId === c.id}
                            onClick={() => setReportingCoupon(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Laporkan Pakai
                          </button>
                          <button
                            type="button"
                            disabled={busyCouponId === c.id}
                            onClick={() => handleReturn(c)}
                            title="Kembalikan ke stok tersedia"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Kembalikan
                          </button>
                        </div>
                      )}
                      {c.status === 'Tersedia' && (
                        <button
                          type="button"
                          disabled={busyCouponId === c.id}
                          onClick={() => handleCancel(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" />
                          Batalkan
                        </button>
                      )}
                      {(c.status === 'Terpakai' || c.status === 'Dibatalkan') && (
                        <span className="text-[11px] text-slate-400">Final</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reportingCoupon && (
        <MarkUsedModal
          coupon={reportingCoupon}
          onClose={() => setReportingCoupon(null)}
        />
      )}
    </div>
  );
}
