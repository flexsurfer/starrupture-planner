import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Base } from '../../../state/db';
import type { MyBasesStats as MyBasesStatsType } from '../types';
import { shareBasesStats } from '../utils/baseStatsShare';

interface ShareBasesStatsButtonProps {
  stats: MyBasesStatsType;
  bases: Base[];
  className?: string;
}

type ShareButtonState = 'idle' | 'sharing' | 'shared' | 'copied' | 'downloaded' | 'failed';

const STATUS_RESET_DELAY_MS = 4000;

const getButtonLabel = (state: ShareButtonState): { desktop: string; mobile: string; title: string; className: string } => {
  switch (state) {
    case 'sharing':
      return {
        desktop: 'Preparing...',
        mobile: '...',
        title: 'Generating your share card.',
        className: 'btn-primary',
      };
    case 'shared':
      return {
        desktop: 'Shared',
        mobile: 'Shared',
        title: 'Shared via your device share dialog.',
        className: 'btn-success',
      };
    case 'copied':
      return {
        desktop: 'Copied',
        mobile: 'Copied',
        title: 'Card copied. Paste it in Discord (Ctrl+V).',
        className: 'btn-success',
      };
    case 'downloaded':
      return {
        desktop: 'Downloaded Card',
        mobile: 'Saved',
        title: 'Card downloaded. Upload it in Discord.',
        className: 'btn-accent',
      };
    case 'failed':
      return {
        desktop: 'Share Failed',
        mobile: 'Failed',
        title: 'Sharing failed. Try again.',
        className: 'btn-error',
      };
    default:
      return {
        desktop: 'Share',
        mobile: 'Share',
        title: 'Generate a stats card and share it in Discord.',
        className: 'btn-primary',
      };
  }
};

export const ShareBasesStatsButton: React.FC<ShareBasesStatsButtonProps> = ({ stats, bases, className }) => {
  const [state, setState] = useState<ShareButtonState>('idle');
  const resetTimerRef = useRef<number | null>(null);
  const isSharingRef = useRef(false);
  const lastShareStartRef = useRef(0);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setState('idle');
      resetTimerRef.current = null;
    }, STATUS_RESET_DELAY_MS);
  }, [clearResetTimer]);

  useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer]);

  const onShare = useCallback(async () => {
    const now = Date.now();
    if (bases.length === 0) return;
    if (state === 'sharing' || isSharingRef.current) return;
    // Guard against double-click / duplicate event firing within the same second.
    if (now - lastShareStartRef.current < 1000) return;

    isSharingRef.current = true;
    lastShareStartRef.current = now;
    setState('sharing');
    try {
      const result = await shareBasesStats(stats, bases, stats.topProducedItems);
      if (result === 'cancelled') {
        setState('idle');
        return;
      }
      if (result === 'shared') setState('shared');
      if (result === 'copied') setState('copied');
      if (result === 'downloaded') setState('downloaded');
      scheduleReset();
    } catch (error) {
      console.error('Failed to share bases stats:', error);
      setState('failed');
      scheduleReset();
    } finally {
      isSharingRef.current = false;
    }
  }, [bases, scheduleReset, state, stats]);

  const buttonInfo = getButtonLabel(state);

  return (
    <button
      className={`btn btn-sm whitespace-nowrap btn-outline ${buttonInfo.className} ${className ?? ''}`}
      onClick={onShare}
      title={buttonInfo.title}
      disabled={bases.length === 0 || state === 'sharing'}
    >
      <span className="hidden sm:inline">{buttonInfo.desktop}</span>
      <span className="sm:hidden">{buttonInfo.mobile}</span>
    </button>
  );
};
