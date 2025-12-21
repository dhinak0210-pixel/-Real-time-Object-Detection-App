
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
      className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all z-40 shadow-2xl overflow-hidden flex flex-col ${
        isOpen ? 'w-80' : 'w-0'
      }`}
    >
      <div className="p-6 flex-1 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <span className="text-green-500">Vision</span>Quest
        </h2>

        <div className="mb-10">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-4">Detection Mode</label>
          <div className="space-y-2">
            {Object.values(AppMode).map((mode) => (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  currentMode === mode 
                    ? 'bg-green-600/20 border-green-500 text-green-400' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <div className="font-medium">{mode}</div>
                <div className="text-xs opacity-60 mt-1 leading-relaxed">{MODE_DESCRIPTIONS[mode]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-4">Sensitivity</label>
          <input 
            type="range" 
            min="0.1" 
            max="0.9" 
            step="0.05"
            value={settings.confidenceThreshold}
            onChange={(e) => updateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
            className="w-full accent-green-500 mb-2"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>Relaxed</span>
            <span>{Math.round(settings.confidenceThreshold * 100)}% Confidence</span>
            <span>Strict</span>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-2">Capabilities</label>
          
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
            <span className="text-sm">Voice Feedback</span>
            <input 
              type="checkbox" 
              checked={settings.voiceAnnounce}
              onChange={(e) => updateSettings({ voiceAnnounce: e.target.checked })}
              className="w-5 h-5 accent-green-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
            <span className="text-sm">Auto-Scan (5s)</span>
            <input 
              type="checkbox" 
              checked={settings.autoScan}
              onChange={(e) => updateSettings({ autoScan: e.target.checked })}
              className="w-5 h-5 accent-green-500"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-800 text-xs text-slate-500">
        VisionQuest AI Engine v1.0.4<br/> Powered by Gemini Flash 3
      </div>
    </div>
  );
};

export default Sidebar;
