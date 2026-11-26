import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let parsedMessage = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        parsedMessage = `${parsed.error} (${parsed.operationType || 'operasi'} pada ${parsed.path || 'data'})`;
      }
    } catch {
      // Keep raw error message
    }
    return {
      hasError: true,
      errorMessage: parsedMessage || 'Terjadi kesalahan saat memproses data aplikasi.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">
                Terjadi Gangguan Sistem
              </h1>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Aplikasi mengalami kendala saat mengakses atau memproses data. Silakan muat ulang halaman untuk melanjutkan.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs font-mono text-slate-700 break-words">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
