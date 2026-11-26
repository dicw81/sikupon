import { Printer, X } from 'lucide-react';
import { Coupon, Distribution } from '../types';
import { formatDateID, formatRupiah } from '../utils/formatters';

interface HandoverReceiptModalProps {
  distribution: Distribution;
  coupons: Coupon[];
  onClose: () => void;
}

export function HandoverReceiptModal({
  distribution,
  coupons,
  onClose,
}: HandoverReceiptModalProps) {
  const relatedCoupons = coupons
    .filter((c) => distribution.couponIds.includes(c.id))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl my-8 print-reset">
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Berita Acara Serah Terima Kupon BBM
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Tanda Terima
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 text-slate-900">
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                TANDA TERIMA PEMBAGIAN KUPON BBM
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Dokumen Pertanggungjawaban Distribusi Bahan Bakar Operasional
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Nomor Dokumen</div>
              <div className="text-sm font-mono font-semibold">
                {distribution.handoverNumber}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">Tanggal Serah Terima</span>
              <span className="font-medium font-mono">
                {formatDateID(distribution.distributedDate)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Staf yang Membagikan</span>
              <span className="font-medium">{distribution.distributedByName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Nama Penerima</span>
              <span className="font-medium">{distribution.recipientName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Unit / Bidang</span>
              <span className="font-medium">{distribution.recipientUnit}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Nomor Polisi Kendaraan</span>
              <span className="font-medium font-mono">
                {distribution.vehiclePlate || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Keperluan</span>
              <span className="font-medium">{distribution.purpose}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-medium">No.</th>
                  <th className="py-2.5 px-3 font-medium">Nomor Seri Kupon</th>
                  <th className="py-2.5 px-3 font-medium">Jenis BBM</th>
                  <th className="py-2.5 px-3 font-medium">Pejabat Asal</th>
                  <th className="py-2.5 px-3 font-medium text-right">Kuota</th>
                  <th className="py-2.5 px-3 font-medium text-right">Nilai (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatedCoupons.map((c, idx) => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium">{c.serialNumber}</td>
                    <td className="py-2 px-3">{c.fuelType}</td>
                    <td className="py-2 px-3 text-slate-600">{c.receivedByOfficial}</td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right">
                      {c.litersPerCoupon} L
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right">
                      {formatRupiah(c.nominalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                  <td colSpan={4} className="py-2.5 px-3">
                    Total ({distribution.couponCount} lembar kupon)
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                    {distribution.totalLiters} L
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                    {formatRupiah(distribution.totalNominal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {distribution.notes && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-800">Catatan:</span> {distribution.notes}
            </p>
          )}

          <div className="pt-8 grid grid-cols-2 gap-12 text-xs text-center">
            <div className="space-y-16">
              <div>
                <p className="text-slate-500">Yang Menyerahkan (Staf Pengelola)</p>
              </div>
              <div className="border-t border-slate-400 pt-2 font-medium">
                {distribution.distributedByName}
              </div>
            </div>
            <div className="space-y-16">
              <div>
                <p className="text-slate-500">Yang Menerima Kupon</p>
              </div>
              <div className="border-t border-slate-400 pt-2 font-medium">
                {distribution.recipientName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
