import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { FileSpreadsheet, Fuel, KeyRound, ShieldCheck, Users } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

interface AuthGateProps {
  hasPendingInvite?: boolean;
}

export function AuthGate({ hasPendingInvite = false }: AuthGateProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gagal masuk dengan akun Google.';
      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
          <span className="text-lg font-semibold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0">
            SiKupon BBM
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Sistem Pendataan &amp; Pelaporan Kupon BBM Bersama
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-blue-800 tracking-wide">
                Administrasi &amp; Berbagi Kupon BBM Keluarga
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
                Data setiap kupon sebelum dibagikan, pantau dan laporkan bersama keluarga.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Mencatat nomor seri kupon sejak awal diterima, membagi kupon ke anggota keluarga atau pengemudi dengan tanda terima yang jelas, serta menyusun laporan pemakaian dalam satu ruang bersama.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                  <Fuel className="w-4 h-4 text-blue-800 shrink-0" />
                  <span>01. Data Batch Awal</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Registrasi nomor seri otomatis per batch saat kupon diterima.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-800 shrink-0" />
                  <span>02. Akses Keluarga</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bagikan link ruang kerja agar anggota keluarga bisa memantau &amp; melapor.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-blue-800 shrink-0" />
                  <span>03. Laporan Siap Cetak</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Rekap pemakaian, ekspor CSV, dan cetak Berita Acara Serah Terima.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              {hasPendingInvite && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
                  <Users className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Anda membuka link undangan Ruang Kupon BBM Keluarga. Masuk dengan akun Google untuk langsung bergabung.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  Masuk ke Ruang Kerja
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Gunakan akun Google masing-masing agar catatan pembagian dan laporan kupon BBM tersimpan rapi dan dapat diakses bersama.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                {loading ? 'Menghubungkan akun...' : 'Masuk dengan Akun Google'}
              </button>

              <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                Hanya anggota keluarga yang menerima link undangan resmi yang dapat melihat dan mengelola data di ruang keluarga Anda.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>SiKupon BBM — Tata Kelola Kupon Bahan Bakar</span>
          <span>Pendataan · Distribusi · Pertanggungjawaban</span>
        </div>
      </footer>
    </div>
  );
}
