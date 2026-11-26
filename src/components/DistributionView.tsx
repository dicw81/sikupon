import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Printer,
  Send,
  XCircle,
} from 'lucide-react';
import {
  cancelDistributionAndReturnCoupons,
  completeDistribution,
  createDistributionAndAssignCoupons,
} from '../services/couponService';
import { Coupon, CouponBatch, Distribution } from '../types';
import {
  formatDateID,
  formatRupiah,
  getTodayISO,
  summarizeSerials,
} from '../utils/formatters';
import { HandoverReceiptModal } from './HandoverReceiptModal';
import { DistributionStatusText } from './StatusText';

interface DistributionViewProps {
  ownerId: string;
  workspaceId: string;
  memberUids: string[];
  staffName: string;
  batches: CouponBatch[];
  coupons: Coupon[];
  distributions: Distribution[];
  onOpenBatchModal: () => void;
}

export function DistributionView({
  ownerId,
  workspaceId,
  memberUids,
  staffName,
  batches,
  coupons,
  distributions,
  onOpenBatchModal,
}: DistributionViewProps) {
  const today = getTodayISO();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([]);
  const [quickTakeCount, setQuickTakeCount] = useState<number>(5);

  const [handoverNumber, setHandoverNumber] = useState(
    `BAST-${today.slice(0, 4)}-${String(distributions.length + 1).padStart(3, '0')}`
  );
  const [distributedDate, setDistributedDate] = useState(today);
  const [distributedByName, setDistributedByName] = useState(staffName);
  const [recipientName, setRecipientName] = useState('');
  const [recipientUnit, setRecipientUnit] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [receiptModalDist, setReceiptModalDist] = useState<Distribution | null>(null);
  const [busyDistId, setBusyDistId] = useState<string | null>(null);

  const availableCoupons = useMemo(() => {
    return coupons
      .filter((c) => {
        if (c.status !== 'Tersedia') return false;
        if (selectedBatchId !== 'ALL' && c.batchId !== selectedBatchId) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.batchCode !== b.batchCode) return a.batchCode.localeCompare(b.batchCode);
        return a.sequenceNumber - b.sequenceNumber;
      });
  }, [coupons, selectedBatchId]);

  const selectedCoupons = useMemo(() => {
    const idSet = new Set(selectedCouponIds);
    return coupons.filter((c) => idSet.has(c.id) && c.status === 'Tersedia');
  }, [coupons, selectedCouponIds]);

  const selectedSummary = useMemo(() => {
    return {
      count: selectedCoupons.length,
      totalNominal: selectedCoupons.reduce((s, c) => s + c.nominalValue, 0),
      totalLiters: selectedCoupons.reduce((s, c) => s + c.litersPerCoupon, 0),
      serialText: summarizeSerials(selectedCoupons),
    };
  }, [selectedCoupons]);

  const handleToggleCoupon = (id: string) => {
    setSelectedCouponIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleQuickSelect = () => {
    const take = Math.max(1, Math.min(100, quickTakeCount));
    const slice = availableCoupons.slice(0, take).map((c) => c.id);
    setSelectedCouponIds(slice);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (selectedCoupons.length === 0) {
      setErrorMsg('Pilih minimal 1 kupon berstatus Tersedia untuk dibagikan.');
      return;
    }

    setSubmitting(true);
    try {
      await createDistributionAndAssignCoupons({
        ownerId,
        workspaceId,
        memberUids,
        handoverNumber,
        recipientName,
        recipientUnit,
        vehiclePlate,
        purpose,
        distributedByName,
        distributedDate,
        notes,
        selectedCoupons,
      });

      setSelectedCouponIds([]);
      setRecipientName('');
      setRecipientUnit('');
      setVehiclePlate('');
      setPurpose('');
      setNotes('');
      setHandoverNumber(
        `BAST-${today.slice(0, 4)}-${String(distributions.length + 2).padStart(3, '0')}`
      );
      setSuccessMsg(
        `Berhasil mencatat pembagian ${selectedCoupons.length} lembar kupon (${selectedSummary.serialText}).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pembagian kupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteDistribution = async (dist: Distribution) => {
    setBusyDistId(dist.id);
    try {
      const related = coupons.filter((c) => dist.couponIds.includes(c.id));
      await completeDistribution(dist, related, getTodayISO(), dist.handoverNumber);
    } finally {
      setBusyDistId(null);
    }
  };

  const handleCancelDistribution = async (dist: Distribution) => {
    setBusyDistId(dist.id);
    try {
      const related = coupons.filter((c) => dist.couponIds.includes(c.id));
      await cancelDistributionAndReturnCoupons(dist, related);
    } finally {
      setBusyDistId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* New distribution split panel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Catat Pembagian Kupon Baru
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih kupon tersedia lalu lengkapi identitas penerima untuk menerbitkan Berita Acara Serah Terima
            </p>
          </div>
          {availableCoupons.length === 0 && (
            <button
              type="button"
              onClick={onOpenBatchModal}
              className="px-3.5 py-1.5 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              Tambah Batch Kupon
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Coupon selector */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-800">
                1. Pilih Kupon Tersedia ({availableCoupons.length} lembar siap)
              </span>
              <select
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setSelectedCouponIds([]);
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">Semua Batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchCode} ({b.fuelType})
                  </option>
                ))}
              </select>
            </div>

            {availableCoupons.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <span className="text-xs text-slate-600">Pilih cepat berurutan:</span>
                <input
                  type="number"
                  min={1}
                  max={Math.min(100, availableCoupons.length)}
                  value={quickTakeCount}
                  onChange={(e) => setQuickTakeCount(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                />
                <span className="text-xs text-slate-600">lembar</span>
                <button
                  type="button"
                  onClick={handleQuickSelect}
                  className="px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                >
                  Pilih Otomatis
                </button>
                {selectedCouponIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCouponIds([])}
                    className="ml-auto text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Bersihkan
                  </button>
                )}
              </div>
            )}

            <div className="border border-slate-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-slate-100">
              {availableCoupons.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Tidak ada kupon berstatus Tersedia pada pilihan batch ini.
                </div>
              ) : (
                availableCoupons.map((c) => {
                  const checked = selectedCouponIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer hover:bg-slate-50 ${
                        checked ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleCoupon(c.id)}
                          className="rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                        />
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-slate-900">
                            {c.serialNumber}
                          </span>
                          <span className="block text-[11px] text-slate-500 truncate">
                            {c.fuelType} · {c.receivedByOfficial}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-slate-700 shrink-0">
                        {formatRupiah(c.nominalValue)} · {c.litersPerCoupon} L
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">
                Terpilih: <strong className="font-mono text-slate-900">{selectedSummary.count}</strong> lembar
              </span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatRupiah(selectedSummary.totalNominal)} · {selectedSummary.totalLiters} L
              </span>
            </div>
          </div>

          {/* Right: Recipient form */}
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-medium text-slate-800 block">
              2. Data Penerima &amp; Berita Acara Serah Terima
            </span>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Nomor BAST</span>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={handoverNumber}
                  onChange={(e) => setHandoverNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Tanggal Pembagian</span>
                <input
                  type="date"
                  required
                  value={distributedDate}
                  onChange={(e) => setDistributedDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Nama Penerima</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Nama pegawai / pengemudi"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Unit / Bidang</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={recipientUnit}
                  onChange={(e) => setRecipientUnit(e.target.value)}
                  placeholder="mis. Subbag Protokol"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">No. Polisi Kendaraan</span>
                <input
                  type="text"
                  maxLength={24}
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="mis. B 1245 KQN"
                  className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Nama Staf Pembagi</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={distributedByName}
                  onChange={(e) => setDistributedByName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Keperluan / Tugas Dinas</span>
              <input
                type="text"
                required
                maxLength={240}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="mis. Kunjungan kerja dan monitoring lapangan"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Catatan (Opsional)</span>
              <input
                type="text"
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Keterangan tambahan serah terima"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || selectedCoupons.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting
                  ? 'Menyimpan pembagian...'
                  : `Catat Pembagian (${selectedCoupons.length} Kupon)`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Distribution history */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Riwayat Berita Acara Pembagian Kupon ({distributions.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar lengkap serah terima kupon kepada pengemudi/unit beserta status pelaporannya
          </p>
        </div>

        {distributions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada riwayat pembagian kupon tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">No. BAST &amp; Tgl</th>
                  <th className="py-2.5 px-4 font-medium">Penerima &amp; Kendaraan</th>
                  <th className="py-2.5 px-4 font-medium">Keperluan</th>
                  <th className="py-2.5 px-4 font-medium">Nomor Seri Diserahkan</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Nilai</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {distributions.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold text-slate-900">
                        {d.handoverNumber}
                      </span>
                      <span className="block text-[11px] font-mono text-slate-500">
                        {formatDateID(d.distributedDate)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{d.recipientName}</span>
                      <span className="block text-[11px] text-slate-500">
                        {d.recipientUnit}
                        {d.vehiclePlate ? ` · ${d.vehiclePlate}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">
                      <span className="line-clamp-2">{d.purpose}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {d.serialSummary}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatRupiah(d.totalNominal)}
                      <span className="block text-[11px] text-slate-500">
                        {d.totalLiters} L
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <DistributionStatusText status={d.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReceiptModalDist(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          BAST
                        </button>
                        {d.status === 'Aktif' && (
                          <>
                            <button
                              type="button"
                              disabled={busyDistId === d.id}
                              onClick={() => handleCompleteDistribution(d)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Selesaikan
                            </button>
                            <button
                              type="button"
                              disabled={busyDistId === d.id}
                              onClick={() => handleCancelDistribution(d)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                              Batalkan
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiptModalDist && (
        <HandoverReceiptModal
          distribution={receiptModalDist}
          coupons={coupons}
          onClose={() => setReceiptModalDist(null)}
        />
      )}
    </div>
  );
}
