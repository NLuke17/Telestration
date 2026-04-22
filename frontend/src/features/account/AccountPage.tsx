import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import { HttpError } from '../../services/api/httpClient';
import Container from '../../components/common/Container';
import Button from '../../components/common/Button';
import InitialAvatar from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentUser, uploadProfileAvatar, type CurrentUserResponse } from '../../services/api/authApi';
import {
  deleteSavedFlipbook,
  getSavedFlipbookPresentation,
  listSavedFlipbooks,
  type SavedFlipbookSummary,
} from '../../services/api/gameApi';
import { encodeDrawingsAsAnimatedGif } from '../../utils/savedFlipbookGif';
import SavedFlipbookPreview from './SavedFlipbookPreview';
import { useTheme } from '../../contexts/ThemeContext';

import lightBg from '../../assets/lightmode.jpg';
import darkBg from '../../assets/darkmode.jpg';
import ColorModeButton from '../../components/common/ColorModeButton';
import { PiMoonStars, PiTrash } from 'react-icons/pi';

function sanitizeFilenameBase(name: string): string {
  return name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'flipbook';
}

const AccountPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { user, logout, mergeUserToSession } = useAuth();
  const [profile, setProfile] = useState<CurrentUserResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedFlipbookSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const gifScratchRef = useRef<HTMLCanvasElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const displayName = profile?.username ?? user?.username ?? 'Player';
  const avatarSrc = profile?.profilePicture ?? user?.profilePicture ?? undefined;

  const stats = useMemo(
    () => ({
      gamesPlayed: profile?.gamesPlayed ?? user?.gamesPlayed ?? 0,
      wins: profile?.wins ?? user?.wins ?? 0,
      votes: profile?.totalVotesReceived ?? user?.totalVotesReceived ?? 0,
    }),
    [profile, user]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setProfileError(null);
        const p = await getCurrentUser();
        if (!cancelled) {
          setProfile(p);
        }
      } catch {
        if (!cancelled) {
          setProfileError('Could not refresh your profile. Statistics may be out of date.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setListError(null);
        const res = await listSavedFlipbooks();
        if (!cancelled) {
          setSavedList(res.savedFlipbooks);
        }
      } catch {
        if (!cancelled) {
          setListError('Could not load saved flipbooks.');
          setSavedList([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleAvatarFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) {
        return;
      }
      setAvatarError(null);
      if (file.size > 2 * 1024 * 1024) {
        setAvatarError('Image must be 2 MB or smaller.');
        return;
      }
      setAvatarUploading(true);
      try {
        const updated = await uploadProfileAvatar(file);
        setProfile(updated);
        mergeUserToSession({
          profilePicture: updated.profilePicture ?? null,
          totalVotesReceived: updated.totalVotesReceived,
          wins: updated.wins,
          gamesPlayed: updated.gamesPlayed,
        });
      } catch (err: unknown) {
        const msg =
          err instanceof HttpError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not update your profile picture.';
        setAvatarError(msg);
      } finally {
        setAvatarUploading(false);
      }
    },
    [mergeUserToSession]
  );

  const handleDownloadGif = useCallback(
    async (summary: SavedFlipbookSummary) => {
      setDownloadMessage(null);
      setDownloadingId(summary.id);
      try {
        const { timeline, savedFlipbook } = await getSavedFlipbookPresentation(summary.id);
        const drawingPayloads = timeline
          .filter((e): e is Extract<typeof e, { kind: 'drawing' }> => e.kind === 'drawing')
          .map((e) => e.drawingData);

        const scratch = gifScratchRef.current ?? undefined;
        const bytes = encodeDrawingsAsAnimatedGif(drawingPayloads, {
          scratchCanvas: scratch,
        });

        const label = savedFlipbook.title?.trim() || savedFlipbook.prompt;
        const base = sanitizeFilenameBase(label);
        const blob = new Blob([Uint8Array.from(bytes)], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base}.gif`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: unknown) {
        const msg = e instanceof Error && e.message === 'NO_DRAWING_FRAMES'
          ? 'This flipbook has no drawings to turn into a GIF yet.'
          : 'Failed to build GIF. Try again in a moment.';
        setDownloadMessage(msg);
      } finally {
        setDownloadingId(null);
      }
    },
    []
  );

  const handleDeleteSaved = useCallback(async (item: SavedFlipbookSummary) => {
    const confirmed = window.confirm(
      'Delete this saved flipbook from your account? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }
    setDeleteMessage(null);
    setDeletingId(item.id);
    try {
      await deleteSavedFlipbook(item.id);
      setSavedList((prev) => prev.filter((s) => s.id !== item.id));
    } catch (err: unknown) {
      const msg =
        err instanceof HttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not delete that flipbook. Try again in a moment.';
      setDeleteMessage(msg);
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div
      className="box-border flex min-h-screen w-full flex-col items-center px-3 py-20 sm:px-6 sm:py-16"
      style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
    >
      {/* Toggle Button */}
      <ColorModeButton />
      <canvas ref={gifScratchRef} className="hidden" aria-hidden />
      <Container
        width="900px"
        height="auto"
        padding="3em"
        className="flex w-full max-w-[900px] flex-col gap-8 rounded-lg border-2 border-dark-grey min-h-0"
      >
        <div className="flex w-full flex-row flex-wrap items-center justify-between gap-4">
          <Button type="button" label="Back to home" onClick={() => navigate('/')} />
          <Button
            type="button"
            label={isLoggingOut ? 'Logging out…' : 'Log out'}
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          />
        </div>

        {profileError && (
          <Alert severity="warning" className="w-full">
            {profileError}
          </Alert>
        )}

        <div className="flex w-full flex-col items-center gap-4 rounded-lg border border-dark-grey bg-sky-50 px-4 py-8 text-center dark:bg-indigo-50 sm:px-8 sm:py-10">
          <div className="relative inline-block rounded-full">
            <button
              type="button"
              className="group relative cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-charcoal disabled:cursor-wait"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label="Change profile picture"
            >
              <InitialAvatar
                name={displayName}
                src={avatarSrc}
                size="112"
                className={avatarUploading ? 'opacity-60' : ''}
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-xs font-semibold text-white opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100">
                {avatarUploading ? 'Saving…' : 'Change photo'}
              </span>
            </button>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(ev) => void handleAvatarFileChange(ev)}
            />
          </div>
          {avatarError ? (
            <Alert severity="error" className="w-full max-w-md" onClose={() => setAvatarError(null)}>
              {avatarError}
            </Alert>
          ) : null}
          <h1 className="text-heading-1 break-words">{displayName}</h1>
          <div className="mt-2 grid w-full max-w-xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-md border border-dark-grey bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Games played</div>
              <div className="text-2xl font-semibold text-brand-charcoal">{stats.gamesPlayed}</div>
            </div>
            <div className="rounded-md border border-dark-grey bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Wins</div>
              <div className="text-2xl font-semibold text-brand-charcoal">{stats.wins}</div>
            </div>
            <div className="rounded-md border border-dark-grey bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Votes received</div>
              <div className="text-2xl font-semibold text-brand-charcoal">{stats.votes}</div>
            </div>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-heading-2 text-light-mode-text-1 dark:text-dark-mode-text-1 mb-4 flex items-center gap-2 text-left">
            <PiMoonStars className="shrink-0 text-indigo-500 dark:text-indigo-400" size={24} aria-hidden />
            Saved flipbooks
          </h2>
          {listError && (
            <Alert severity="error" className="mb-4 w-full">
              {listError}
            </Alert>
          )}
          {downloadMessage && (
            <Alert severity="info" className="mb-4 w-full" onClose={() => setDownloadMessage(null)}>
              {downloadMessage}
            </Alert>
          )}
          {deleteMessage && (
            <Alert severity="error" className="mb-4 w-full" onClose={() => setDeleteMessage(null)}>
              {deleteMessage}
            </Alert>
          )}
          {savedList.length === 0 && !listError ? (
            <p className="text-body-base text-gray-600 dark:text-dark-mode-text-2">
              You have not saved any flipbooks yet. Finish a game and save one from the recap screen.
            </p>
          ) : (
            <ul className="m-0 grid w-full list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
              {savedList.map((item) => (
                <li
                  key={item.id}
                  className="relative flex min-w-0 flex-col items-center gap-3 rounded-lg border border-dark-grey bg-white p-3 pt-10"
                >
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/50 dark:disabled:border-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                    aria-label={
                      deletingId === item.id ? 'Deleting saved flipbook' : 'Delete saved flipbook from library'
                    }
                    disabled={downloadingId !== null || deletingId !== null}
                    onClick={() => void handleDeleteSaved(item)}
                  >
                    <PiTrash size={18} aria-hidden />
                  </button>
                  <SavedFlipbookPreview savedId={item.id} />
                  <div className="flex w-full min-w-0 flex-col items-center gap-2 px-1 text-center">
                    <div className="min-w-0">
                      <div className="font-semibold text-brand-charcoal line-clamp-2">
                        {item.title?.trim() || item.prompt}
                      </div>
                      {item.title?.trim() ? (
                        <div className="mt-1 line-clamp-2 text-sm text-gray-600">{item.prompt}</div>
                      ) : null}
                      <div className="mt-2 text-xs text-gray-500">
                        Saved {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      type="button"
                      label={downloadingId === item.id ? 'Building GIF…' : 'Download as GIF'}
                      disabled={downloadingId !== null || deletingId !== null}
                      onClick={() => void handleDownloadGif(item)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </div>
  );
};

export default AccountPage;
