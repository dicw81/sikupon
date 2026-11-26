import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createCouponBatchWithCoupons } from '../services/couponService';
import { FuelType } from '../types';
import { buildSerialNumber, formatRupiah, getTodayISO } from '../utils/formatters';

interface BatchModalProps {
  ownerId: string;
  workspaceId: string;
  memberUids: string[];
  onClose: () => void;
  onCreated: () => void;
}

const FUEL_TYPES: FuelType[] = ['Pertamax', 'Pertalite', 'Dexlite', 'Solar'];

export function BatchModal({
  ownerId,
  workspaceId,
  memberUids,
  onClose,
  onCreated,
}: BatchModalProps) {
  const today = getTodayISO();
  const [batchCode, setBatchCode] = useState(`BATCH-${today.slice(0, 7)}-01`);
  const [source, setSource] = useState('Bagian Umum Sekretariat');
  const [receivedByOfficial, setReceivedByOfficial] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [fuelType, setFuelType] = useState<FuelType>('Pertamax');
  const [nominalValue, setNominalValue] = useState(100000);
  const [litersPerCoupon, setLitersPerCoupon] = useState(8);
  const [prefix, setPrefix] = useState('PTX-26-');
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(25);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const start = Math.max(1, Math.floor(startNumber || 1));
    const end = Math.max(start, Math.floor(endNumber || start));
    const count = end - start + 1;
    const firstSerial = buildSerialNumber(prefix || 'BBM-', start);
    const lastSerial = buildSerialNumber(prefix || 'BBM-', end);
    return {
      count,
      firstSerial,
      lastSerial,
      totalNominal: count * (Number(nominalValue) || 0),
      totalLiters: count * (Number(litersPerCoupon) || 0),
    };
  }, [prefix, startNumber, endNumber, nominalValue, litersPerCoupon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!receivedByOfficial.trim()) {
      setError('Nama pejabat penerima kupon wajib diisi.');
      return;
    }
    if (preview.count < 1 || preview.count > 200) {
      setError('Jumlah kupon dalam satu batch harus antara 1 hingga 200 lembar.');
      return;
    }

    setSubmitting(true);
    try {
      await createCouponBatchWithCoupons({
        ownerId,
        workspaceId,
        memberUids,
        batchCode,
        source,
        receivedByOfficial,
        receivedDate,
        fuelType,
        nominalValue,
        litersPerCoupon,
        prefix,
        startNumber,
        endNumber,
        notes,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan batch kupon.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Catat Batch Kupon Baru
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftarkan kupon yang diterima pejabat beserta rentang nomor serinya sebelum dibagikan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Kode Batch</span>
              <input
                type="text"
                required
                maxLength={40}
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="mis. BATCH-2026-11-01"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Tanggal Diterima</span>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Pejabat Penerima Kupon</span>
              <input
                type="text"
                required
                maxLength={100}
                value={receivedByOfficial}
                onChange={(e) => setReceivedByOfficial(e.target.value)}
                placeholder="Nama pejabat penerima"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Asal / Sumber Kupon</span>
              <input
                type="text"
                required
                maxLength={120}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="mis. Sekretariat Daerah / SPBU Mitra"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Jenis BBM</span>
              <select
                value={fuelType}
                onChange={(e) => {
                  const next = e.target.value as FuelType;
                  setFuelType(next);
                  if (next === 'Pertamax') setPrefix('PTX-26-');
                  if (next === 'Pertalite') setPrefix('PTL-26-');
                  if (next === 'Dexlite') setPrefix('DXL-26-');
                  if (next === 'Solar') setPrefix('SLR-26-');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              >
                {FUEL_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {ft}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Nilai per Kupon (Rp)</span>
              <input
                type="number"
                min={0}
                step={5000}
                required
                value={nominalValue}
                onChange={(e) => setNominalValue(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Kuota per Kupon (Liter)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                required
                value={litersPerCoupon}
                onChange={(e) => setLitersPerCoupon(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Awalan Nomor Seri</span>
              <input
                type="text"
                required
                maxLength={24}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="PTX-26-"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Nomor Urut Awal</span>
              <input
                type="number"
                min={1}
                required
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Nomor Urut Akhir</span>
              <input
                type="number"
                min={startNumber}
                required
                value={endNumber}
                onChange={(e) => setEndNumber(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </label>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="text-slate-500">Pratinjau Nomor Seri Terbentuk</div>
              <div className="font-mono font-medium text-slate-900">
                {preview.firstSerial} s/d {preview.lastSerial}
              </div>
            </div>
            <div className="flex items-center gap-6 tabular-nums">
              <div>
                <div className="text-slate-500">Jumlah Kupon</div>
                <div className="font-mono font-semibold text-slate-900">
                  {preview.count} lembar
                </div>
              </div>
              <div>
                <div className="text-slate-500">Total Nilai</div>
                <div className="font-mono font-semibold text-slate-900">
                  {formatRupiah(preview.totalNominal)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Total Kuota</div>
                <div className="font-mono font-semibold text-slate-900">
                  {preview.totalLiters} L
                </div>
              </div>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Catatan Tambahan (Opsional)</span>
            <input
              type="text"
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Alokasi operasional kegiatan dinas bulan berjalan"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || preview.count > 200 || preview.count < 1}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {submitting ? 'Menyimpan...' : `Simpan ${preview.count} Lembar Kupon`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
