import React, { useState, useEffect, useCallback, useRef } from 'react';
import CameraView from './components/CameraView';
import Sidebar from './components/Sidebar';
import { AppMode, AppSettings, Detection, DetectionResult, PerformanceMetrics, EventLog } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [settings, setSettings] = useState<AppSettings>({
    confidenceThreshold: 0.50,
    voiceAnnounce: true,
    maxDetections: 6,
    speechRate: 1.0,
    videoSource: 'webcam',
    cctvUrl: 'https://assets.mixkit.co/videos/preview/mixkit-street-traffic-with-cars-and-buses-41551-large.mp4'
  });

  const [results, setResults] = useState<DetectionResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({ latency: 0, fps: 0, detectionsCount: 0 });
  const [history, setHistory] = useState<EventLog[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  
  const lastSpokenRef = useRef<number>(0);
  const lastSpokenTextRef = useRef<string>("");
  const lastLogTimeRef = useRef<number>(0);

  // Browser Speak (TTS)
  const playAudio = useCallback((text: string) => {
    if (!settings.voiceAnnounce) return;
    const now = Date.now();
    
    // Throttle voice alerts to prevent spam (max once every 7 seconds, or if text changes)
    if (text !== lastSpokenTextRef.current || now - lastSpokenRef.current >= 7000) {
      lastSpokenRef.current = now;
      lastSpokenTextRef.current = text;

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = settings.speechRate;
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [settings.voiceAnnounce, settings.speechRate]);

  // Generate summaries and metrics locally from COCO-SSD detections
  const handleDetection = useCallback((rawDetections: Detection[], latencyVal: number) => {
    // Filter by user's confidence cutoff and slice to max detections
    const filtered = rawDetections
      .filter(d => d.confidence >= settings.confidenceThreshold)
      .slice(0, settings.maxDetections);

    // Update real-time metrics
    setMetrics({
      latency: latencyVal,
      fps: Math.max(1, Math.round(1000 / (latencyVal + 20))), // frame-to-frame rendering FPS representation
      detectionsCount: filtered.length
    });

    // Generate local summary and reasoning heuristics
    const counts: Record<string, number> = {};
    filtered.forEach(d => {
      counts[d.label] = (counts[d.label] || 0) + 1;
    });

    const countStrings = Object.entries(counts).map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`);
    const summary = filtered.length > 0 
      ? `Local Edge DL detected: ${countStrings.join(', ')}.` 
      : "No targets currently tracked in active grid.";

    let reasoning = "";
    if (currentMode === AppMode.RETAIL) {
      const lowStock = filtered.filter(d => d.status === 'low-stock');
      if (lowStock.length > 0) {
        reasoning = `Edge telemetry flagged: ${lowStock.map(d => d.label).join(', ')} as low-shelf count. Prompting inventory system queue.`;
      } else {
        reasoning = "Context: retail layout optimal. Bins and shelves meet minimum target counts.";
      }
    } else if (currentMode === AppMode.SECURITY) {
      const suspicious = filtered.filter(d => d.status === 'suspicious');
      if (suspicious.length > 0) {
        reasoning = `Security perimeter alert: Tracked ${suspicious.map(d => d.label).join(', ')} classified under high-risk status.`;
      } else {
        reasoning = "Area perimeter secure. No anomalies or prohibited devices registered.";
      }
    } else if (currentMode === AppMode.ACCESSIBILITY) {
      reasoning = filtered.length > 0 
        ? `Accessibility Guidance: ${filtered.map(d => d.label).join(' and ')} detected in path. Audio announcement ready.`
        : "Navigation path clear. No objects obstructing active track.";
    } else if (currentMode === AppMode.EDUCATIONAL) {
      reasoning = `Educational mode: Classifying items for visual learning. COCO dataset maps match target classes.`;
    } else {
      reasoning = filtered.length > 0 
        ? `Visual Heuristics: Dominant target is ${filtered[0].label} with ${Math.round(filtered[0].confidence * 100)}% accuracy in center view.`
        : "Scanning environment... Local model looking for common objects (persons, chairs, bags, cups).";
    }

    setResults({
      detections: filtered,
      summary,
      reasoning,
      timestamp: Date.now()
    });

    // Update history/logs panel (throttle log entries to at most once per second to prevent clutter)
    const now = Date.now();
    if (filtered.length > 0 && now - lastLogTimeRef.current >= 1500) {
      lastLogTimeRef.current = now;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const newLogs = filtered.map(d => ({
        time: timeStr,
        label: d.label,
        confidence: d.confidence,
        status: d.status,
        mode: currentMode.split('/')[0]
      }));

      setHistory(prev => [...newLogs, ...prev].slice(0, 20));
    }

    // Trigger TTS
    if (filtered.length > 0 && settings.voiceAnnounce) {
      playAudio(summary);
    }
  }, [currentMode, settings.confidenceThreshold, settings.maxDetections, settings.voiceAnnounce, playAudio]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm transition-opacity duration-300" 
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <Sidebar 
        currentMode={currentMode} 
        setMode={setCurrentMode} 
        settings={settings}
        updateSettings={updateSettings}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className={`flex-1 relative transition-all duration-300 flex flex-col ${sidebarOpen ? 'ml-0 lg:ml-80' : 'ml-0'}`}>
        {/* Header/Controls */}
        <header className="absolute top-0 left-0 right-0 p-4 z-30 flex justify-between items-center pointer-events-none">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl pointer-events-auto hover:bg-slate-800 hover:border-slate-700 transition-all shadow-lg active:scale-95 animate-pulse"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex gap-4 pointer-events-auto">
            <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl flex items-center gap-6 shadow-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Latency</span>
                <span className="font-mono text-green-400 font-bold">{metrics.latency}ms</span>
              </div>
              <div className="flex flex-col border-l border-slate-800 pl-6">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Objects</span>
                <span className="font-mono text-green-400 font-bold">{metrics.detectionsCount}</span>
              </div>
              <div className="flex flex-col border-l border-slate-800 pl-6">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Inference FPS</span>
                <span className="font-mono text-green-400 font-bold">{metrics.fps > 0 ? metrics.fps : '--'}</span>
              </div>
              <div className="flex flex-col border-l border-slate-800 pl-6">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Mode</span>
                <span className="font-bold text-white text-xs bg-slate-850 px-2 py-0.5 rounded border border-slate-850">
                  {currentMode.split('/')[0]}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 bg-slate-950 relative">
          <CameraView 
            onDetection={handleDetection} 
            settings={settings}
            updateSettings={updateSettings}
            currentMode={currentMode}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            history={history}
          />
        </div>

        {/* Results Panel */}
        <div className="h-72 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 p-6 overflow-y-auto z-30 shadow-2xl">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Environment Summary */}
            <div className="lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                  Local System Summary
                </h3>
                {results ? (
                  <p className="text-slate-100 text-sm font-medium leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 max-h-40 overflow-y-auto">
                    {results.summary}
                  </p>
                ) : (
                  <p className="text-slate-500 text-sm italic bg-slate-950/20 p-4 rounded-xl border border-dashed border-slate-800">
                    Initializing local ML weights. Detection stream will display here.
                  </p>
                )}
              </div>
            </div>
            
            {/* Logic & Reasoning */}
            <div className="lg:col-span-1">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2.5">Edge Heuristics</h3>
              {results?.reasoning ? (
                <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/60 text-slate-300 text-xs leading-relaxed max-h-40 overflow-y-auto">
                  <strong className="text-green-400 block mb-1">Spatial/Context Analysis:</strong>
                  {results.reasoning}
                </div>
              ) : (
                <div className="p-4 bg-slate-950/20 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs italic">
                  Run camera scan feed to display layout analysis.
                </div>
              )}
            </div>

            {/* Live Event & Tracking Log */}
            <div className="lg:col-span-1">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2.5 flex justify-between items-center">
                <span>Live Event Log</span>
                {history.length > 0 && (
                  <button 
                    onClick={() => setHistory([])}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-normal font-normal"
                  >
                    Clear Log
                  </button>
                )}
              </h3>
              <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3 h-40 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin">
                {history.length > 0 ? (
                  history.map((evt, idx) => (
                    <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-900 last:border-0 animate-fade-in">
                      <span className="text-slate-500">{evt.time}</span>
                      <span className={`font-semibold ${evt.status === 'suspicious' || evt.status === 'low-stock' ? 'text-rose-400' : 'text-slate-200'}`}>
                        {evt.label}
                      </span>
                      <span className="text-[10px] bg-green-950/30 text-green-400 px-1.5 rounded border border-green-900/20">
                        {Math.round(evt.confidence * 100)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-600 italic py-12">
                    Waiting for events...
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
