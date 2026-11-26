import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  FileSpreadsheet,
  Fuel,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  Plus,
  Send,
  Users,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { BatchModal } from './components/BatchModal';
import { DashboardView } from './components/DashboardView';
import { DistributionView } from './components/DistributionView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FamilyShareModal } from './components/FamilyShareModal';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { ensureUserProfile } from './services/couponService';
import {
  ensurePersonalWorkspaceAndMigrate,
  joinWorkspaceWithInvite,
  syncWorkspaceMembersToDocs,
} from './services/workspaceService';
import {
  AppTab,
  Coupon,
  CouponBatch,
  Distribution,
  FamilyWorkspace,
  UserProfile,
} from './types';

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'inventory', label: 'Stok & Batch Kupon', icon: Package },
  { id: 'distributions', label: 'Pembagian Kupon', icon: Send },
  { id: 'reports', label: 'Laporan & Ekspor', icon: FileSpreadsheet },
];

const PENDING_INVITE_STORAGE_KEY = 'sikupon_pending_invite';

function readInviteFromUrlOrStorage(): { workspaceId: string; inviteCode: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const keluarga = params.get('keluarga')?.trim();
  const kode = params.get('kode')?.trim();
  if (keluarga && kode) {
    const invite = { workspaceId: keluarga, inviteCode: kode };
    try {
      sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, JSON.stringify(invite));
    } catch {
      // ignore storage errors
    }
    return invite;
  }
  try {
    const saved = sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { workspaceId?: string; inviteCode?: string };
      if (parsed.workspaceId && parsed.inviteCode) {
        return { workspaceId: parsed.workspaceId, inviteCode: parsed.inviteCode };
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function clearStoredInvite(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  if (url.searchParams.has('keluarga') || url.searchParams.has('kode')) {
    url.searchParams.delete('keluarga');
    url.searchParams.delete('kode');
    window.history.replaceState({}, '', url.toString());
  }
}

function WorkspaceShell() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<FamilyWorkspace[]>([]);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [pendingInvite, setPendingInvite] = useState<{
    workspaceId: string;
    inviteCode: string;
  } | null>(() => readInviteFromUrlOrStorage());

  const [allBatches, setAllBatches] = useState<CouponBatch[]>([]);
  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);
  const [allDistributions, setAllDistributions] = useState<Distribution[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setWorkspaceReady(false);
      return;
    }

    let cancelled = false;
    const displayName =
      user.displayName || user.email?.split('@')[0] || 'Anggota Keluarga';

    const initWorkspace = async () => {
      await ensureUserProfile(user.uid, displayName);
      await ensurePersonalWorkspaceAndMigrate(user.uid, displayName);

      if (pendingInvite) {
        try {
          const res = await joinWorkspaceWithInvite(
            pendingInvite.workspaceId,
            pendingInvite.inviteCode,
            user.uid,
            displayName
          );
          if (!cancelled) {
            setInviteNotice({
              type: 'ok',
              text: `Berhasil terhubung ke Ruang Keluarga "${res.workspaceName}".`,
            });
          }
        } catch (err) {
          if (!cancelled) {
            setInviteNotice({
              type: 'err',
              text:
                err instanceof Error
                  ? err.message
                  : 'Link undangan keluarga tidak valid.',
            });
          }
        } finally {
          clearStoredInvite();
          if (!cancelled) setPendingInvite(null);
        }
      }

      if (!cancelled) setWorkspaceReady(true);
    };

    void initWorkspace();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, pendingInvite]);

  useEffect(() => {
    if (!authReady || !user || !workspaceReady) {
      if (!user) {
        setAllBatches([]);
        setAllCoupons([]);
        setAllDistributions([]);
        setWorkspaces([]);
        setProfile(null);
        setDataLoading(false);
      }
      return;
    }

    setDataLoading(true);
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 4) setDataLoading(false);
    };

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`)
    );

    const workspacesQuery = query(
      collection(db, 'workspaces'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsubWorkspaces = onSnapshot(
      workspacesQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FamilyWorkspace, 'id'>),
        }));
        setWorkspaces(list);
        markLoaded();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'workspaces')
    );

    const batchesQuery = query(
      collection(db, 'batches'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsubBatches = onSnapshot(
      batchesQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CouponBatch, 'id'>),
        }));
        list.sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
        setAllBatches(list);
        markLoaded();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'batches')
    );

    const couponsQuery = query(
      collection(db, 'coupons'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsubCoupons = onSnapshot(
      couponsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Coupon, 'id'>),
        }));
        setAllCoupons(list);
        markLoaded();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'coupons')
    );

    const distQuery = query(
      collection(db, 'distributions'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsubDist = onSnapshot(
      distQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Distribution, 'id'>),
        }));
        list.sort((a, b) => {
          if (a.distributedDate !== b.distributedDate) {
            return b.distributedDate.localeCompare(a.distributedDate);
          }
          return b.handoverNumber.localeCompare(a.handoverNumber);
        });
        setAllDistributions(list);
        markLoaded();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'distributions')
    );

    return () => {
      unsubProfile();
      unsubWorkspaces();
      unsubBatches();
      unsubCoupons();
      unsubDist();
    };
  }, [authReady, user, workspaceReady]);

  const activeWorkspaceId =
    profile?.activeWorkspaceId ||
    workspaces[0]?.id ||
    (user ? `ws_${user.uid}` : '');

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === activeWorkspaceId) ||
      workspaces[0] ||
      null,
    [workspaces, activeWorkspaceId]
  );

  const batches = useMemo(
    () => allBatches.filter((b) => b.workspaceId === activeWorkspaceId),
    [allBatches, activeWorkspaceId]
  );

  const coupons = useMemo(
    () => allCoupons.filter((c) => c.workspaceId === activeWorkspaceId),
    [allCoupons, activeWorkspaceId]
  );

  const distributions = useMemo(
    () => allDistributions.filter((d) => d.workspaceId === activeWorkspaceId),
    [allDistributions, activeWorkspaceId]
  );

  // Sync memberUids to existing workspace documents automatically when a new family member joins
  useEffect(() => {
    if (!activeWorkspace || dataLoading) return;
    void syncWorkspaceMembersToDocs(activeWorkspace, {
      batches,
      coupons,
      distributions,
    });
  }, [activeWorkspace, batches, coupons, distributions, dataLoading]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Memuat ruang kerja SiKupon BBM...
      </div>
    );
  }

  if (!user) {
    return <AuthGate hasPendingInvite={Boolean(pendingInvite)} />;
  }

  const staffName =
    profile?.displayName ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'Anggota Keluarga';

  const memberUids = activeWorkspace?.memberUids || [user.uid];
  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center gap-2.5 border-b border-slate-200">
          <Fuel className="w-5 h-5 text-blue-900 shrink-0" />
          <span className="text-base font-semibold tracking-tight text-slate-900 font-display whitespace-nowrap">
            SiKupon BBM
          </span>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
          <div className="text-[11px] font-medium text-slate-500">
            Ruang Keluarga Aktif
          </div>
          <div className="text-xs font-semibold text-slate-900 truncate">
            {activeWorkspace?.name || 'Kupon BBM Keluarga'}
          </div>
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            Bagikan ke Keluarga ({memberUids.length})
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs">
            <div className="font-medium text-slate-900 truncate">{staffName}</div>
            <div className="text-slate-500 truncate">
              {profile?.roleLabel || 'Pengelola Kupon Keluarga'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white border-r border-slate-200 flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-blue-900" />
                <span className="text-base font-semibold text-slate-900 font-display">
                  SiKupon BBM
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShareModalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-900 bg-blue-50 rounded-lg"
              >
                <Users className="w-3.5 h-3.5" />
                Bagikan ke Keluarga ({memberUids.length})
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline truncate max-w-48">
                {activeWorkspace?.name || 'SiKupon BBM'}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link Keluarga
            </button>
            <button
              type="button"
              onClick={() => setBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Batch Kupon
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-4">
          {inviteNotice && (
            <div
              className={`no-print p-3.5 rounded-xl border text-xs flex items-center justify-between gap-4 ${
                inviteNotice.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <span>{inviteNotice.text}</span>
              <button
                type="button"
                onClick={() => setInviteNotice(null)}
                className="text-current opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              ownerId={user.uid}
              workspaceId={activeWorkspaceId}
              memberUids={memberUids}
              staffName={staffName}
              loading={dataLoading || !workspaceReady}
              batches={batches}
              coupons={coupons}
              distributions={distributions}
              onOpenBatchModal={() => setBatchModalOpen(true)}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              batches={batches}
              coupons={coupons}
              onOpenBatchModal={() => setBatchModalOpen(true)}
            />
          )}

          {activeTab === 'distributions' && (
            <DistributionView
              ownerId={user.uid}
              workspaceId={activeWorkspaceId}
              memberUids={memberUids}
              staffName={staffName}
              batches={batches}
              coupons={coupons}
              distributions={distributions}
              onOpenBatchModal={() => setBatchModalOpen(true)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              coupons={coupons}
              distributions={distributions}
              staffName={staffName}
            />
          )}
        </main>
      </div>

      {batchModalOpen && activeWorkspaceId && (
        <BatchModal
          ownerId={user.uid}
          workspaceId={activeWorkspaceId}
          memberUids={memberUids}
          onClose={() => setBatchModalOpen(false)}
          onCreated={() => {
            if (activeTab === 'dashboard') {
              setActiveTab('inventory');
            }
          }}
        />
      )}

      {shareModalOpen && (
        <FamilyShareModal
          currentUserUid={user.uid}
          currentUserName={staffName}
          activeWorkspace={activeWorkspace}
          availableWorkspaces={workspaces}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceShell />
    </ErrorBoundary>
  );
}
