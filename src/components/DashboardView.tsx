import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Database,
  FileSpreadsheet,
  Plus,
  Send,
} from 'lucide-react';
import { seedSampleData } from '../services/couponService';
import { AppTab, Coupon, CouponBatch, Distribution, FuelType } from '../types';
import { formatDateID, formatNumber, formatRupiah } from '../utils/formatters';
import { DistributionStatusText } from './StatusText';

interface DashboardViewProps {
  ownerId: string;
  workspaceId: string;
  memberUids: string[];
  staffName: string;
  loading: boolean;
  batches: CouponBatch[];
  coupons: Coupon[];
  distributions: Distribution[];
  onOpenBatchModal: () => void;
  onNavigate: (tab: AppTab) => void;
}

export function DashboardView({
  ownerId,
  workspaceId,
  memberUids,
  staffName,
  loading,
  batches,
  coupons,
  distributions,
  onOpenBatchModal,
  onNavigate,
}: DashboardViewProps) {
  const [seeding, setSeeding] = useState(false);

  const stats = useMemo(() => {
    const activeCoupons = coupons.filter((c) => c.status !== 'Dibatalkan');
    const available = coupons.filter((c) => c.status === 'Tersedia');
    const distributed = coupons.filter((c) => c.status === 'Dibagikan');
    const used = coupons.filter((c) => c.status === 'Terpakai');

    const totalNominal = activeCoupons.reduce((s, c) => s + c.nominalValue, 0);
    const availableNominal = available.reduce((s, c) => s + c.nominalValue, 0);
    const distributedNominal = distributed.reduce((s, c) => s + c.nominalValue, 0);
    const usedNominal = used.reduce((s, c) => s + c.nominalValue, 0);
    const totalLiters = activeCoupons.reduce((s, c) => s + c.litersPerCoupon, 0);

    const byFuel: Record<
      FuelType,
      { total: number; available: number; distributed: number; used: number; nominal: number }
    > = {
      Pertamax: { total: 0, available: 0, distributed: 0, used: 0, nominal: 0 },
      Pertalite: { total: 0, available: 0, distributed: 0, used: 0, nominal: 0 },
      Dexlite: { total: 0, available: 0, distributed: 0, used: 0, nominal: 0 },
      Solar: { total: 0, available: 0, distributed: 0, used: 0, nominal: 0 },
    };

    for (const c of activeCoupons) {
      byFuel[c.fuelType].total += 1;
      byFuel[c.fuelType].nominal += c.nominalValue;
      if (c.status === 'Tersedia') byFuel[c.fuelType].available += 1;
      if (c.status === 'Dibagikan') byFuel[c.fuelType].distributed += 1;
      if (c.status === 'Terpakai') byFuel[c.fuelType].used += 1;
    }

    const byOfficialMap = new Map<
      string,
      {
        official: string;
        batches: number;
        total: number;
        available: number;
        distributed: number;
        used: number;
        nominal: number;
      }
    >();

    for (const b of batches) {
      const existing = byOfficialMap.get(b.receivedByOfficial) || {
        official: b.receivedByOfficial,
        batches: 0,
        total: 0,
        available: 0,
        distributed: 0,
        used: 0,
        nominal: 0,
      };
      existing.batches += 1;
      byOfficialMap.set(b.receivedByOfficial, existing);
    }

    for (const c of activeCoupons) {
      const existing = byOfficialMap.get(c.receivedByOfficial) || {
        official: c.receivedByOfficial,
        batches: 0,
        total: 0,
        available: 0,
        distributed: 0,
        used: 0,
        nominal: 0,
      };
      existing.total += 1;
      existing.nominal += c.nominalValue;
      if (c.status === 'Tersedia') existing.available += 1;
      if (c.status === 'Dibagikan') existing.distributed += 1;
      if (c.status === 'Terpakai') existing.used += 1;
      byOfficialMap.set(c.receivedByOfficial, existing);
    }

    return {
      totalCount: activeCoupons.length,
      availableCount: available.length,
      distributedCount: distributed.length,
      usedCount: used.length,
      totalNominal,
      availableNominal,
      distributedNominal,
      usedNominal,
      totalLiters,
      byFuel,
      byOfficial: Array.from(byOfficialMap.values()),
    };
  }, [batches, coupons]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedSampleData(ownerId, workspaceId, memberUids, staffName);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-5 h-28 animate-pulse"
            />
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 h-64 animate-pulse" />
      </div>
    );
  }

  if (batches.length === 0 && coupons.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 max-w-2xl mx-auto mt-8 text-center space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Belum Ada Batch Kupon BBM Terdata
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            Mulai dengan mendaftarkan kupon yang diterima pejabat (kode batch dan rentang nomor seri) agar setiap lembar kupon yang dibagikan staf terlacak dan mudah dilaporkan.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onOpenBatchModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Catat Batch Kupon Pertama
          </button>
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeed}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Database className="w-4 h-4" />
            {seeding ? 'Memuat data contoh...' : 'Muat Data Contoh (30 Kupon)'}
          </button>
        </div>
      </div>
    );
  }

  const recentDistributions = distributions.slice(0, 5);
  const reportingRate =
    stats.totalCount > 0 ? Math.round((stats.usedCount / stats.totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Total Kupon Terdata</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {formatNumber(stats.totalCount)}{' '}
            <span className="text-sm font-sans font-normal text-slate-500">lembar</span>
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {formatRupiah(stats.totalNominal)} · {formatNumber(stats.totalLiters)} L
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Tersedia di Stok</p>
          <p className="text-2xl font-semibold text-emerald-700 font-mono tabular-nums">
            {formatNumber(stats.availableCount)}{' '}
            <span className="text-sm font-sans font-normal text-slate-500">lembar</span>
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {formatRupiah(stats.availableNominal)} · Siap dibagikan
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Sudah Dibagikan</p>
          <p className="text-2xl font-semibold text-amber-700 font-mono tabular-nums">
            {formatNumber(stats.distributedCount)}{' '}
            <span className="text-sm font-sans font-normal text-slate-500">lembar</span>
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {formatRupiah(stats.distributedNominal)} · Menunggu struk
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Terpakai &amp; Dilaporkan</p>
          <p className="text-2xl font-semibold text-blue-800 font-mono tabular-nums">
            {formatNumber(stats.usedCount)}{' '}
            <span className="text-sm font-sans font-normal text-slate-500">lembar</span>
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {formatRupiah(stats.usedNominal)} · {reportingRate}% terealisasi
          </p>
        </div>
      </div>

      {/* Quick action bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">Alur Kerja Harian:</span>{' '}
          <span>Catat batch masuk</span>
          <span className="mx-2 text-slate-400">·</span>
          <span>Serahkan kupon ke pengemudi</span>
          <span className="mx-2 text-slate-400">·</span>
          <span>Laporkan pemakaian &amp; cetak rekap</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('distributions')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            Bagikan Kupon
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Lihat Laporan
          </button>
        </div>
      </div>

      {/* Rekap Pejabat & Jenis BBM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Rekapitulasi per Pejabat Penerima
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Posisi stok kupon yang diterima pejabat dan status pembagiannya
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 hover:underline cursor-pointer whitespace-nowrap"
            >
              Kelola Stok
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">Pejabat Penerima</th>
                  <th className="py-2.5 px-4 font-medium text-right">Diterima</th>
                  <th className="py-2.5 px-4 font-medium text-right">Tersedia</th>
                  <th className="py-2.5 px-4 font-medium text-right">Dibagikan</th>
                  <th className="py-2.5 px-4 font-medium text-right">Terpakai</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.byOfficial.map((row) => (
                  <tr key={row.official} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {row.official}
                      <span className="block text-[11px] font-normal text-slate-500">
                        {row.batches} batch terdaftar
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {row.total}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {row.available}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 font-medium">
                      {row.distributed}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-800 font-medium">
                      {row.used}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatRupiah(row.nominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Distribusi per Jenis BBM
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan kupon tersedia, dibagikan, dan terpakai
            </p>
          </div>
          <div className="p-5 space-y-5">
            {(['Pertamax', 'Pertalite', 'Dexlite', 'Solar'] as FuelType[]).map((ft) => {
              const item = stats.byFuel[ft];
              const pctUsed =
                item.total > 0 ? Math.round(((item.distributed + item.used) / item.total) * 100) : 0;
              return (
                <div key={ft} className="space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-900">{ft}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {item.available} tersedia · {item.distributed} dibagikan · {item.used} terpakai
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-800 rounded-full transition-all"
                      style={{ width: `${pctUsed}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent distributions */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Pembagian Kupon Terbaru
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              5 transaksi serah terima kupon terakhir kepada penerima
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('distributions')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 hover:underline cursor-pointer whitespace-nowrap"
          >
            Semua Pembagian
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {recentDistributions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada kupon yang dibagikan. Gunakan menu Pembagian Kupon untuk mencatat serah terima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">No. BAST</th>
                  <th className="py-2.5 px-4 font-medium">Tanggal</th>
                  <th className="py-2.5 px-4 font-medium">Penerima &amp; Unit</th>
                  <th className="py-2.5 px-4 font-medium">Kendaraan</th>
                  <th className="py-2.5 px-4 font-medium">Rentang Seri</th>
                  <th className="py-2.5 px-4 font-medium text-right">Nilai</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDistributions.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {d.handoverNumber}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {formatDateID(d.distributedDate)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{d.recipientName}</span>
                      <span className="block text-[11px] text-slate-500">{d.recipientUnit}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {d.vehiclePlate || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{d.serialSummary}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatRupiah(d.totalNominal)}
                    </td>
                    <td className="py-3 px-4">
                      <DistributionStatusText status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
