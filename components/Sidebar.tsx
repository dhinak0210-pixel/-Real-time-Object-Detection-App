import React from 'react';
import { AppMode, AppSettings } from '../types';
import { MODE_DESCRIPTIONS } from '../constants';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode, settings, updateSettings, isOpen, onToggle }) => {
  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 shadow-2xl overflow-hidden flex flex-col ${
        isOpen ? 'w-80' : 'w-0'
      }`}
    >
      <div className="p-6 flex-1 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <span className="text-green-500">Vision</span>Quest <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-mono">PRO</span>
        </h2>

        {/* Local Deep Learning Engine Status */}
        <div className="mb-8 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-2">DL Inference Engine</label>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Framework:</span>
              <span className="font-mono text-green-400 font-bold">TensorFlow.js (v4)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Model:</span>
              <span className="font-mono text-slate-300">COCO-SSD MobileNet</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Location:</span>
              <span className="text-slate-300 font-semibold bg-green-950/40 text-green-400 px-1.5 py-0.5 rounded text-[10px]">
                100% Local (Offline)
              </span>
            </div>
          </div>
        </div>

        {/* Detection Mode */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">Detection Mode</label>
          <div className="space-y-2">
            {Object.values(AppMode).map((mode) => (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  currentMode === mode 
                    ? 'bg-green-600/20 border-green-500 text-green-400 shadow-lg shadow-green-500/5' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-sm">{mode}</div>
                <div className="text-xs opacity-60 mt-1 leading-relaxed">{MODE_DESCRIPTIONS[mode]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Confidence Threshold */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">Confidence Cutoff</label>
          <input 
            type="range" 
            min="0.10" 
            max="0.90" 
            step="0.05"
            value={settings.confidenceThreshold}
            onChange={(e) => updateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
            className="w-full accent-green-500 mb-1"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>Relaxed</span>
            <span className="font-mono text-green-400 font-bold">{Math.round(settings.confidenceThreshold * 100)}%</span>
            <span>Strict</span>
          </div>
        </div>

        {/* Max Detections Limit */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">Max Bounding Boxes</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            step="1"
            value={settings.maxDetections}
            onChange={(e) => updateSettings({ maxDetections: parseInt(e.target.value) })}
            className="w-full accent-green-500 mb-1"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>1 box</span>
            <span className="font-mono text-green-400 font-bold">{settings.maxDetections} targets</span>
            <span>20 boxes</span>
          </div>
        </div>

        {/* Speech Rate Control */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">Voice Speech Rate</label>
          <input 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.1"
            value={settings.speechRate}
            onChange={(e) => updateSettings({ speechRate: parseFloat(e.target.value) })}
            className="w-full accent-green-500 mb-1"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>Slow</span>
            <span className="font-mono text-green-400 font-bold">{settings.speechRate.toFixed(1)}x</span>
            <span>Fast</span>
          </div>
        </div>

        {/* Video Source Configuration */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-3">Camera Source Type</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 border border-slate-800 rounded-xl mb-4">
            <button
              onClick={() => updateSettings({ videoSource: 'webcam' })}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                settings.videoSource === 'webcam'
                  ? 'bg-green-550 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📷 Local Webcam
            </button>
            <button
              onClick={() => updateSettings({ videoSource: 'cctv' })}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                settings.videoSource === 'cctv'
                  ? 'bg-green-550 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📡 CCTV / IP Stream
            </button>
          </div>

          {settings.videoSource === 'cctv' && (
            <div className="space-y-3 p-3 bg-slate-800/25 border border-slate-800 rounded-xl">
              <div>
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">CCTV / IP Stream URL</label>
                <input
                  type="text"
                  value={settings.cctvUrl}
                  onChange={(e) => updateSettings({ cctvUrl: e.target.value })}
                  placeholder="http://192.168.1.100/mjpeg or video.mp4"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-green-500 font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block leading-normal">
                  Supports local network streams, MJPEG feeds, HLS, or mp4 loops.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1.5">Load Test Presets</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => updateSettings({ cctvUrl: 'https://assets.mixkit.co/videos/preview/mixkit-street-traffic-with-cars-and-buses-41551-large.mp4' })}
                    className="py-1 px-2 bg-slate-900 border border-slate-800 text-[10px] text-slate-350 hover:bg-slate-800 rounded transition-all text-left truncate"
                    title="Traffic Monitor (Cars, Buses)"
                  >
                    🚗 Traffic Feed
                  </button>
                  <button
                    onClick={() => updateSettings({ cctvUrl: 'https://assets.mixkit.co/videos/preview/mixkit-people-walking-in-a-busy-city-street-40019-large.mp4' })}
                    className="py-1 px-2 bg-slate-900 border border-slate-800 text-[10px] text-slate-355 hover:bg-slate-800 rounded transition-all text-left truncate"
                    title="Pedestrian Monitor (People)"
                  >
                    🚶 Pedestrian Feed
                  </button>
                  <button
                    onClick={() => updateSettings({ cctvUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-working-on-his-laptop-at-home-42410-large.mp4' })}
                    className="py-1 px-2 bg-slate-900 border border-slate-800 text-[10px] text-slate-355 hover:bg-slate-800 rounded transition-all text-left truncate"
                    title="Office Monitor (Laptop, Cup)"
                  >
                    💼 Office Feed
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Platform Options */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-2">Platform Options</label>
          
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Voice Alerts</span>
              <span className="text-[10px] text-slate-500">Audio environment alerts</span>
            </div>
            <input 
              type="checkbox" 
              checked={settings.voiceAnnounce}
              onChange={(e) => updateSettings({ voiceAnnounce: e.target.checked })}
              className="w-5 h-5 accent-green-500 rounded"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-800 text-xs text-slate-500 flex justify-between items-center bg-slate-950/20">
        <span>VisionQuest AI v2.0.0</span>
        <span className="text-green-500 font-bold">Local Edge inference</span>
      </div>
    </div>
  );
};

export default Sidebar;
