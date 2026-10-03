import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Download, X, AlertCircle, ArrowRight } from 'lucide-react';
import { bridge } from '../services/bridge';
import type { UpdateInfo } from '../services/bridge';

export const UpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async (manual = false) => {
    try {
      const rawInfo: any = await bridge.checkForUpdates();
      const hasUpdate = Boolean(rawInfo?.hasUpdate ?? rawInfo?.HasUpdate);
      const info: UpdateInfo | null = rawInfo ? {
        hasUpdate,
        currentVersion: rawInfo.currentVersion ?? rawInfo.CurrentVersion ?? '',
        latestVersion: rawInfo.latestVersion ?? rawInfo.LatestVersion ?? '',
        releaseNotes: rawInfo.releaseNotes ?? rawInfo.ReleaseNotes ?? '',
        downloadUrl: rawInfo.downloadUrl ?? rawInfo.DownloadUrl ?? '',
        publishedAt: rawInfo.publishedAt ?? rawInfo.PublishedAt ?? ''
      } : null;
      if (info && hasUpdate) {
        setUpdateInfo(info);
        setIsOpen(true);
      } else if (manual) {
        // Broadcast that app is up to date
        window.dispatchEvent(new CustomEvent('update_checked', { detail: { upToDate: true } }));
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
    }
  };

  useEffect(() => {
    // Initial check after 2 seconds
    const initialTimer = setTimeout(() => runCheck(false), 2000);

    // Periodic check every 2 minutes
    // Periodic background check every 4 hours
    const interval = setInterval(() => runCheck(false), 4 * 60 * 60 * 1000);

    // Listen for manual trigger from Sidebar or Header
    const handleManualCheck = () => runCheck(true);
    window.addEventListener('check_for_updates_manual', handleManualCheck);

    // Listen for download progress from backend
    const unsubscribe = bridge.on('update_progress', (payload: { progress: number }) => {
      if (typeof payload?.progress === 'number') {
        setProgress(payload.progress);
        if (payload.progress >= 95) {
          setError(null); // Clear any transient timeout messages during restart
        }
      }
      if (typeof payload?.progress === 'number') {
        setProgress(payload.progress);
      }
    });

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('check_for_updates_manual', handleManualCheck);
      unsubscribe();
    };
  }, []);

  if (!isOpen || !updateInfo) return null;

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    setError(null);
    setProgress(5);

    try {
      await bridge.installUpdate(updateInfo.downloadUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to download and install update.');
      setIsUpdating(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'linear-gradient(145deg, #141416 0%, #0c0c0e 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 84, 0, 0.25)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 84, 0, 0.15)',
          padding: '24px',
          position: 'relative',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Close button (if not currently downloading) */}
        {!isUpdating && (
          <button
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subdued)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(255, 84, 0, 0.15)',
              border: '1px solid rgba(255, 84, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FF5400'
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              Update Available
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-subdued)' }}>
                v{updateInfo.currentVersion}
              </span>
              <ArrowRight size={12} color="#FF5400" />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#FF5400',
                  background: 'rgba(255, 84, 0, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}
              >
                v{updateInfo.latestVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Release notes */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid var(--border-subtle)',
            maxHeight: '160px',
            overflowY: 'auto',
            fontSize: '13px',
            lineHeight: '1.6',
            color: 'var(--text-subdued)'
          }}
        >
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#FF5400' }}>✦</span>
            <span>What's New in this update:</span>
          </div>
          {(() => {
            const rawNotes = updateInfo.releaseNotes || '';
            const filteredLines = rawNotes
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0)
              .filter((l) => !l.toLowerCase().includes('velopack') 
                          && !l.toLowerCase().includes('velpack') 
                          && !l.toLowerCase().includes('.nupkg') 
                          && !l.toLowerCase().includes('sha256')
                          && !l.toLowerCase().includes('ready to install'));

            if (filteredLines.length === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#FF5400', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#e0e0e0' }}>Player full screen layout and view fixes</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#FF5400', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#e0e0e0' }}>Shuffle play option on all playlists & library</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#FF5400', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#e0e0e0' }}>Persistent song and queue state across app launches</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#FF5400', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#e0e0e0' }}>Stable home recommendations caching</span>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredLines.map((line, idx) => {
                  const clean = line.replace(/^[#*\-•\s]+/, '').trim();
                  if (!clean) return null;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#FF5400', fontWeight: 800, flexShrink: 0 }}>•</span>
                      <span style={{ color: '#e0e0e0' }}>{clean}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Progress Bar during update */}
        {isUpdating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-subdued)' }}>
              <span>Downloading update...</span>
              <span style={{ fontWeight: 700, color: '#FF5400' }}>{progress}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: '#1e1e24',
                borderRadius: '500px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #FF5400, #ff7a33)',
                  borderRadius: '500px',
                  transition: 'width 0.25s ease'
                }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subdued)', textAlign: 'center', marginTop: '2px' }}>
              Ragam will restart automatically once download finishes.
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 84, 84, 0.12)',
              border: '1px solid rgba(255, 84, 84, 0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#ff6b6b'
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        {!isUpdating && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '500px',
                color: 'var(--text-subdued)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-subdued)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              Remind Me Later
            </button>

            <button
              onClick={handleUpdateNow}
              style={{
                flex: 1.4,
                padding: '10px 14px',
                background: '#FF5400',
                border: 'none',
                borderRadius: '500px',
                color: '#000',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(255, 84, 0, 0.3)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Download size={15} />
              <span>Update & Restart</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
