import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { bridge } from '../services/bridge';

export const TitleBar: React.FC = () => {
  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <img src="/logo.svg" alt="RAGAM" style={{ width: 18, height: 18, objectFit: "contain" }} />
        <span style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>RAGAM</span>
      </div>

      <div className="titlebar-controls">
        <button className="window-btn" onClick={() => bridge.windowMinimize()} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="window-btn" onClick={() => bridge.windowMaximize()} title="Maximize / Restore">
          <Square size={12} />
        </button>
        <button className="window-btn close" onClick={() => bridge.windowClose()} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
