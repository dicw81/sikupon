import React, { useState } from 'react';
import { Check, Copy, Link2, RefreshCw, Users, X } from 'lucide-react';
import {
  buildFamilyShareLink,
  joinWorkspaceWithInvite,
  parseInviteFromInput,
  rotateWorkspaceInviteCode,
  switchActiveWorkspace,
  updateWorkspaceName,
} from '../services/workspaceService';
import { FamilyWorkspace } from '../types';

interface FamilyShareModalProps {
  currentUserUid: string;
  currentUserName: string;
  activeWorkspace: FamilyWorkspace | null;
  availableWorkspaces: FamilyWorkspace[];
  onClose: () => void;
}

export function FamilyShareModal({
  currentUserUid,
  currentUserName,
  activeWorkspace,
  availableWorkspaces,
  onClose,
}: FamilyShareModalProps) {
  const [nameInput, setNameInput] = useState(activeWorkspace?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [copiedType, setCopiedType] = useState<'link' | 'whatsapp' | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const shareLink = activeWorkspace
    ? buildFamilyShareLink(activeWorkspace.id, activeWorkspace.inviteCode)
    : '';

  const isOwner = activeWorkspace?.ownerId === currentUserUid;

  const handleCopy = async (mode: 'link' | 'whatsapp') => {
    if (!shareLink || !activeWorkspace) return;
    const text =
      mode === 'link'
        ? shareLink
        : `Halo, silakan buka link berikut untuk mengakses dan mencatat kupon BBM keluarga bersama (${activeWorkspace.name}):\n${shareLink}\n\nMasuk menggunakan akun Google masing-masing agar otomatis terhubung.`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(mode);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      setFeedback({
        type: 'err',
        text: 'Gagal menyalin otomatis. Silakan blok dan salin link secara manual.',
      });
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !isOwner) return;
    setSavingName(true);
    setFeedback(null);
    try {
      await updateWorkspaceName(activeWorkspace, nameInput);
      setFeedback({ type: 'ok', text: 'Nama ruang keluarga berhasil diperbarui.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui nama ruang.',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleRotateCode = async () => {
    if (!activeWorkspace || !isOwner) return;
    setRotating(true);
    setFeedback(null);
    try {
      await rotateWorkspaceInviteCode(activeWorkspace);
      setFeedback({
        type: 'ok',
        text: 'Link undangan baru telah dibuat. Link lama sudah dinonaktifkan.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui kode link.',
      });
    } finally {
      setRotating(false);
    }
  };

  const handleJoinManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const parsed = parseInviteFromInput(joinInput);
    if (!parsed) {
      setFeedback({
        type: 'err',
        text: 'Format link tidak valid. Tempel link undangan keluarga yang lengkap.',
      });
      return;
    }

    setJoining(true);
    try {
      const res = await joinWorkspaceWithInvite(
        parsed.workspaceId,
        parsed.inviteCode,
        currentUserUid,
        currentUserName
      );
      setJoinInput('');
      setFeedback({
        type: 'ok',
        text: `Berhasil bergabung ke ruang keluarga "${res.workspaceName}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal bergabung ke ruang keluarga.',
      });
    } finally {
      setJoining(false);
    }
  };

  const membersList = activeWorkspace
    ? activeWorkspace.memberUids.map((uid) => ({
        uid,
        name: activeWorkspace.memberNames?.[uid] || 'Anggota Keluarga',
        isOwner: uid === activeWorkspace.ownerId,
      }))
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Akses Bersama Keluarga
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bagikan link ini kepada anggota keluarga agar dapat melihat, membagi, dan melaporkan kupon bersama.
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

        <div className="p-6 space-y-6">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {activeWorkspace && (
            <>
              {/* Shareable Link Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Link2 className="w-4 h-4 text-blue-900" />
                    Link Undangan Keluarga
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {membersList.length} / 15 anggota
                  </span>
                </div>

                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy('link')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedType === 'link' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Link Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin Link Keluarga
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopy('whatsapp')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedType === 'whatsapp' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        Pesan WhatsApp Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin Pesan untuk WhatsApp
                      </>
                    )}
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      disabled={rotating}
                      onClick={handleRotateCode}
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
                      Buat Ulang Link
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Saat keluarga Anda membuka link ini dan masuk dengan akun Google mereka, stok kupon, pembagian, dan laporan akan langsung tersinkronisasi bersama.
                </p>
              </div>

              {/* Workspace Name & Members */}
              <div className="space-y-4">
                {isOwner && (
                  <form onSubmit={handleRename} className="flex items-end gap-2">
                    <label className="flex-1 space-y-1">
                      <span className="text-xs font-medium text-slate-700">
                        Nama Ruang Keluarga
                      </span>
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={100}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={savingName}
                      className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {savingName ? 'Menyimpan...' : 'Simpan Nama'}
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    Anggota yang Terhubung ({membersList.length})
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {membersList.map((m) => (
                      <div
                        key={m.uid}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-slate-900">
                          {m.name}
                          {m.uid === currentUserUid && (
                            <span className="text-slate-500 font-normal"> (Anda)</span>
                          )}
                        </span>
                        <span className="text-slate-500">
                          {m.isOwner ? 'Pembuat Ruang' : 'Anggota Keluarga'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Switch workspace if member of multiple */}
          {availableWorkspaces.length > 1 && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <span className="text-xs font-medium text-slate-700 block">
                Pindah Ruang Keluarga
              </span>
              <div className="flex flex-wrap gap-2">
                {availableWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => void switchActiveWorkspace(currentUserUid, ws.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      ws.id === activeWorkspace?.id
                        ? 'bg-blue-50 border-blue-800 text-blue-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Join another family workspace manually */}
          <form
            onSubmit={handleJoinManual}
            className="pt-4 border-t border-slate-200 space-y-2"
          >
            <span className="text-xs font-medium text-slate-700 block">
              Gabung ke Ruang Keluarga Lain
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Tempel link undangan dari anggota keluarga..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
              <button
                type="submit"
                disabled={joining || !joinInput.trim()}
                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {joining ? 'Memproses...' : 'Gabung'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
