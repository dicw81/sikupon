import { CheckCircle2, Clock, PackageCheck, XCircle } from 'lucide-react';
import { CouponStatus, DistributionStatus } from '../types';

export function CouponStatusText({ status }: { status: CouponStatus }) {
  switch (status) {
    case 'Tersedia':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <PackageCheck className="w-3.5 h-3.5 shrink-0" />
          Tersedia
        </span>
      );
    case 'Dibagikan':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Dibagikan
        </span>
      );
    case 'Terpakai':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Terpakai
        </span>
      );
    case 'Dibatalkan':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          Dibatalkan
        </span>
      );
  }
}

export function DistributionStatusText({ status }: { status: DistributionStatus }) {
  switch (status) {
    case 'Aktif':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Belum Selesai
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Selesai Dilaporkan
        </span>
      );
    case 'Dibatalkan':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          Dibatalkan
        </span>
      );
  }
}
