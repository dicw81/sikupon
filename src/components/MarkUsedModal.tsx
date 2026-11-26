import React, { useState } from 'react';
import { X } from 'lucide-react';
import { markCouponUsed } from '../services/couponService';
import { Coupon } from '../types';
import { formatRupiah, getTodayISO } from '../utils/formatters';

interface MarkUsedModalProps {
  coupon: Coupon;
  onClose: () => void;
}

export function MarkUsedModal({ coupon, onClose }: MarkUsedModalProps) {
  const [usedDate, setUsedDate] = useState(getTodayISO());
  const [receiptNumber, setReceiptNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await markCouponUsed(coupon.id, usedDate, receiptNumber || `STRUK-${coupon.serialNumber}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status kupon.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Laporkan Pemakaian Kupon
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {coupon.serialNumber} · {coupon.fuelType}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Penerima</span>
              <span className="font-medium text-slate-900">{coupon.recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Kendaraan</span>
              <span className="font-mono text-slate-900">{coupon.vehiclePlate || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Nilai Kupon</span>
              <span className="font-mono text-slate-900">
                {formatRupiah(coupon.nominalValue)} · {coupon.litersPerCoupon} L
              </span>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Tanggal Pengisian / Pakai</span>
            <input
              type="date"
              required
              value={usedDate}
              onChange={(e) => setUsedDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Nomor Struk / Nota SPBU</span>
            <input
              type="text"
              maxLength={60}
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="mis. SPBU-34129-8812"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Laporan Pemakaian'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
