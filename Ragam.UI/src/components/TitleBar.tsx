import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { bridge } from '../services/bridge';

export const TitleBar: React.FC = () => {
  return (
    <div className="titlebar">
      <div className="titlebar-brand" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <svg
          viewBox="0 0 1080 250"
          style={{ height: '18px', width: 'auto' }}
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="matrix(16.19932,0,0,16.19932,-3087.455651,-6390.203435)">
            <text
              x="193.324px"
              y="408.452px"
              style={{
                fontFamily: "'Nevera-Regular', 'Nevera', sans-serif",
                fontSize: '15.347px',
                fill: '#FF5400',
                fontWeight: 800,
              }}
            >
              RA<tspan x="215.7px" y="408.452px">G</tspan>AM
            </text>
          </g>
        </svg>
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
