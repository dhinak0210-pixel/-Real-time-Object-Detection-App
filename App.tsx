
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CameraView from './components/CameraView';
import Sidebar from './components/Sidebar';
import { AppMode, AppSettings, DetectionResult, PerformanceMetrics } from './types';
import { GeminiService } from './services/geminiService';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [settings, setSettings] = useState<AppSettings>({
    confidenceThreshold: 0.5,
    autoScan: false,
    scanInterval: 5000,
    voiceAnnounce: true
  });
  const [results, setResults] = useState<DetectionResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({ latency: 0, fps: 0, detectionsCount: 0 });
  
  const geminiRef = useRef<GeminiService | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    geminiRef.current = new GeminiService();
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }, []);

  const playAudio = async (text: string) => {
    if (!geminiRef.current || !audioContextRef.current || !settings.voiceAnnounce) return;
    try {
      const buffer = await geminiRef.current.speak(text);
      const audioBuffer = await audioContextRef.current.decodeAudioData(buffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  };

  const handleCapture = useCallback(async (base64: string) => {
    if (!geminiRef.current || isScanning) return;

    const start = performance.now();
    setIsScanning(true);
    
    try {
      const res = await geminiRef.current.detectObjects(base64, currentMode);
      const end = performance.now();
      
      setResults(res);
      setMetrics({
        latency: Math.round(end - start),
        fps: 0, // Calculated separately if streaming
        detectionsCount: res.detections.length
      });

      if (settings.voiceAnnounce) {
        playAudio(res.summary);
      }
    } catch (error) {
      console.error("Scan failed", error);
    } finally {
      setIsScanning(false);
    }
  }, [currentMode, isScanning, settings.voiceAnnounce]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const filteredDetections = results?.detections.filter(d => d.confidence >= settings.confidenceThreshold) || [];

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}

      <Sidebar 
        currentMode={currentMode} 
        setMode={setCurrentMode} 
        settings={settings}
        updateSettings={updateSettings}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className={`flex-1 relative transition-all flex flex-col ${sidebarOpen ? 'ml-0 lg:ml-80' : 'ml-0'}`}>
        {/* Header/Controls */}
        <header className="absolute top-0 left-0 right-0 p-4 z-30 flex justify-between items-center pointer-events-none">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl pointer-events-auto hover:bg-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex gap-4 pointer-events-auto">
            <div className="px-4 py-2 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Latency</span>
                <span className="font-mono text-green-400">{metrics.latency}ms</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Objects</span>
                <span className="font-mono text-green-400">{filteredDetections.length}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Mode</span>
                <span className="font-bold text-white text-xs">{currentMode.split('/')[0]}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 bg-slate-950 relative">
          <CameraView 
            onCapture={handleCapture} 
            results={results} 
            settings={settings}
            isScanning={isScanning}
          />
        </div>

        {/* Results Panel */}
        {results && (
          <div className="h-64 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 p-6 overflow-y-auto z-30">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  AI Environment Summary
                </h3>
                <p className="text-lg font-medium leading-relaxed">{results.summary}</p>
                {results.reasoning && (
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 italic text-slate-300 text-sm">
                    <strong>Logic:</strong> {results.reasoning}
                  </div>
                )}
              </div>
              
              <div className="w-full md:w-72">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Detected Objects</h3>
                <div className="grid grid-cols-2 gap-2">
                  {filteredDetections.slice(0, 6).map((det, i) => (
                    <div key={i} className="bg-slate-800 border border-slate-700 p-2 rounded flex justify-between items-center">
                      <span className="text-xs font-medium truncate pr-2">{det.label}</span>
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded">{Math.round(det.confidence * 100)}%</span>
                    </div>
                  ))}
                  {filteredDetections.length > 6 && (
                    <div className="col-span-2 text-center text-xs text-slate-500 mt-1">
                      + {filteredDetections.length - 6} more objects
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
