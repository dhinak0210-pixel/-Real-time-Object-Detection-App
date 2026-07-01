import React, { useState, useEffect, useRef } from 'react';
import { AppMode, AppSettings, Detection, EventLog } from '../types';

interface CameraViewProps {
  onDetection: (detections: Detection[], latency: number) => void;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  currentMode: AppMode;
  isPaused: boolean;
  setIsPaused: (p: boolean) => void;
  history: EventLog[];
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onDetection, 
  settings, 
  updateSettings, 
  currentMode,
  isPaused,
  setIsPaused,
  history
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [model, setModel] = useState<any>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [localDetections, setLocalDetections] = useState<Detection[]>([]);
  const [inferenceFps, setInferenceFps] = useState<number>(0);

  // Webcams Enumeration
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Load COCO-SSD Model from global script
  useEffect(() => {
    let active = true;
    async function loadCocoSsd() {
      while (!(window as any).cocoSsd) {
        await new Promise(r => setTimeout(r, 100));
      }
      try {
        console.log("Initializing local COCO-SSD engine (Full MobileNetV2)...");
        const loadedModel = await (window as any).cocoSsd.load({ base: 'mobilenet_v2' });
        if (active) {
          setModel(loadedModel);
          setModelLoading(false);
        }
      } catch (err) {
        console.error("Failed to load local ML model", err);
      }
    }
    loadCocoSsd();
    return () => { active = false; };
  }, []);

  // Enumerate cameras list (only when Webcam source is active)
  useEffect(() => {
    if (settings.videoSource !== 'webcam') return;
    
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevices = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(vDevices);
        
        if (vDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(vDevices[0].deviceId);
        }
      } catch (err) {
        console.warn("Failed to enumerate video devices", err);
      }
    }
    getDevices();
  }, [isReady, settings.videoSource]);

  // Video / Stream Source Setup
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let active = true;

    async function setupSource() {
      try {
        setCamError(null);
        setIsReady(false);

        if (!videoRef.current) return;

        if (settings.videoSource === 'cctv') {
          // Play CCTV / Video Loop Stream
          videoRef.current.srcObject = null;
          videoRef.current.src = settings.cctvUrl;
          videoRef.current.crossOrigin = "anonymous"; // Safe snapshot export
          videoRef.current.loop = true;
          
          await videoRef.current.play().catch(e => {
            console.warn("CCTV play failed, checking video path...", e);
            if (active) {
              setCamError("CCTV Stream URL could not be loaded. Please check that the URL is valid, CORS is enabled on the stream, or the network link is active.");
            }
          });
          
          if (active) {
            setIsReady(true);
          }
        } else {
          // Play Webcam
          videoRef.current.src = "";
          let stream: MediaStream;
          
          const constraints: MediaStreamConstraints = {
            video: selectedDeviceId 
              ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          };

          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (e) {
            console.warn("High-res video input failed, falling back to basic stream...");
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true 
            });
          }

          activeStream = stream;
          if (videoRef.current && active) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(e => console.warn("Video play blocked", e));
            setIsReady(true);
          }
        }
      } catch (err: any) {
        console.error("Failed to load video source.", err);
        if (active) {
          setCamError(
            settings.videoSource === 'cctv'
              ? "CCTV stream loading error. Ensure your link is accessible directly in the browser and supports standard HTML5 tags."
              : "Camera access failed. Please ensure a camera is connected, permission is granted in the browser, and you are using a secure context."
          );
        }
      }
    }

    setupSource();

    return () => {
      active = false;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      setIsReady(false);
    };
  }, [selectedDeviceId, settings.videoSource, settings.cctvUrl]);

  // Real-Time COCO-SSD Detection Loop (runs at ~15-30 FPS)
  useEffect(() => {
    if (!isReady || !videoRef.current || !model || isPaused) return;

    let animId: number;
    let lastInferenceTime = 0;
    let framesCount = 0;
    let lastFpsUpdateTime = 0;

    async function detectFrame() {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        animId = requestAnimationFrame(detectFrame);
        return;
      }

      const now = performance.now();
      if (now - lastInferenceTime >= 60) {
        const start = performance.now();
        try {
          const predictions = await model.detect(videoRef.current);
          const end = performance.now();
          const latency = Math.round(end - start);

          const w = videoRef.current.videoWidth || 640;
          const h = videoRef.current.videoHeight || 480;

          const detections: Detection[] = predictions.map((pred: any) => {
            const [x, y, boxW, boxH] = pred.bbox;
            
            let status: Detection['status'] = 'normal';
            if (pred.class === 'person') status = 'normal';
            else if (pred.class === 'backpack' || pred.class === 'suitcase') status = 'suspicious';
            else if (pred.class === 'cell phone' || pred.class === 'cup') status = 'ok';

            return {
              label: pred.class,
              confidence: pred.score,
              box_2d: {
                ymin: Math.max(0, y / h),
                xmin: Math.max(0, x / w),
                ymax: Math.min(1, (y + boxH) / h),
                xmax: Math.min(1, (x + boxW) / w)
              },
              status
            };
          });

          setLocalDetections(detections);

          framesCount++;
          if (now - lastFpsUpdateTime >= 1000) {
            setInferenceFps(Math.round((framesCount * 1000) / (now - lastFpsUpdateTime)));
            framesCount = 0;
            lastFpsUpdateTime = now;
          }

          onDetection(detections, latency);
        } catch (e) {
          console.error("Frame prediction loop failed", e);
        }
        lastInferenceTime = now;
      }
      animId = requestAnimationFrame(detectFrame);
    }

    animId = requestAnimationFrame(detectFrame);
    return () => cancelAnimationFrame(animId);
  }, [isReady, model, onDetection, isPaused]);

  // Combined Canvas Drawing Loop (runs in requestAnimationFrame for maximum smoothness)
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let renderAnimId: number;

    const render = () => {
      let renderWidth = 1280;
      let renderHeight = 720;

      if (videoRef.current) {
        renderWidth = videoRef.current.videoWidth || 1280;
        renderHeight = videoRef.current.videoHeight || 720;
      }

      canvasRef.current!.width = renderWidth;
      canvasRef.current!.height = renderHeight;

      ctx.clearRect(0, 0, renderWidth, renderHeight);

      localDetections.forEach((det: Detection) => {
        if (det.confidence < settings.confidenceThreshold) return;

        const { ymin, xmin, ymax, xmax } = det.box_2d;
        
        const top = ymin * renderHeight;
        const left = xmin * renderWidth;
        const height = (ymax - ymin) * renderHeight;
        const width = (xmax - xmin) * renderWidth;

        let color = '#22c55e';
        if (det.status === 'low-stock' || det.status === 'suspicious') color = '#ef4444';
        else if (det.confidence < 0.70) color = '#eab308';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, width, height);

        const tickLen = Math.min(20, width / 4, height / 4);
        ctx.fillStyle = color;
        
        ctx.fillRect(left - 2, top - 2, tickLen, 4);
        ctx.fillRect(left - 2, top - 2, 4, tickLen);

        ctx.fillRect(left + width - tickLen + 2, top - 2, tickLen, 4);
        ctx.fillRect(left + width - 2, top - 2, 4, tickLen);

        ctx.fillRect(left - 2, top + height - 2, tickLen, 4);
        ctx.fillRect(left - 2, top + height - tickLen + 2, 4, tickLen);

        ctx.fillRect(left + width - tickLen + 2, top + height - 2, tickLen, 4);
        ctx.fillRect(left + width - 2, top + height - tickLen + 2, 4, tickLen);

        ctx.fillStyle = color;
        const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
        ctx.font = 'bold 15px Inter, system-ui';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(left - 2, top - 28, textWidth + 14, 26);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, left + 5, top - 10);
      });

      if (!isPaused) {
        const phase = (Date.now() / 2500) % 1;
        const scanY = phase * renderHeight;
        ctx.strokeStyle = '#22c55e1c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(renderWidth, scanY);
        ctx.stroke();
      }

      renderAnimId = requestAnimationFrame(render);
    };

    renderAnimId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(renderAnimId);
  }, [localDetections, settings.confidenceThreshold, isReady, isPaused]);

  // Capture current stream view + canvas overrides
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const w = videoRef.current.videoWidth || 1280;
      const h = videoRef.current.videoHeight || 720;
      tempCanvas.width = w;
      tempCanvas.height = h;

      tempCtx.drawImage(videoRef.current, 0, 0, w, h);
      tempCtx.drawImage(canvasRef.current, 0, 0, w, h);

      const url = tempCanvas.toDataURL('image/png');
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `visionquest-hud-${Date.now()}.png`;
      downloadAnchor.click();
    } catch (e) {
      console.warn("Snapshot capture failed due to CORS restriction on the active CCTV feed.", e);
      alert("Could not export snapshot. Some external CCTV camera URLs restrict image exporting due to CORS security policies.");
    }
  };

  // Export event history log
  const exportLogData = () => {
    if (history.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `visionquest-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center">
      {camError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-8 text-center z-30">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-6 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-200 uppercase tracking-widest font-mono">
            {settings.videoSource === 'cctv' ? 'CCTV Loading Error' : 'Webcam Stream Blocked'}
          </h3>
          <p className="text-slate-500 text-sm max-w-lg mt-3 leading-relaxed font-sans">
            {camError}
          </p>
          <div className="mt-8 p-4 bg-slate-900 border border-slate-800 rounded-xl max-w-md text-xs text-slate-400 leading-relaxed font-mono">
            <span className="text-yellow-400 font-bold block mb-1">Troubleshooting:</span>
            {settings.videoSource === 'cctv' ? (
              <>
                1. Verify that the CCTV Stream URL matches standard formats (MP4, HLS, MJPEG).<br/>
                2. Test with one of the preloaded feeds in the sidebar.<br/>
                3. Ensure the network camera allows cross-origin requests (CORS).
              </>
            ) : (
              <>
                1. Click the camera icon in your URL bar and select "Always allow camera".<br/>
                2. Verify you are visiting <span className="text-green-400">http://localhost:3000</span> or an <span className="text-green-400">https://</span> domain.<br/>
                3. Ensure no other applications are using the webcam.
              </>
            )}
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute w-full h-full object-cover"
        />
      )}
      
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full object-cover z-20 pointer-events-none"
      />

      {modelLoading && !camError && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500/35 border-t-green-500 rounded-full animate-spin"></div>
          <span className="text-slate-200 font-mono text-sm tracking-widest animate-pulse">
            LOADING LOCAL ML ENGINE...
          </span>
          <span className="text-slate-500 text-xs font-sans">
            Caching COCO-SSD weights on browser edge (one-time load)
          </span>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none border-[12px] border-slate-950/80 z-10">
        <div className="absolute top-6 left-6 text-slate-400 font-mono text-[10px] tracking-wider uppercase bg-slate-900/50 px-2.5 py-1 rounded border border-slate-800/40">
          SOURCE: {settings.videoSource === 'cctv' ? 'CCTV_STREAM' : 'LOCAL_WEBCAM'}
        </div>
        <div className="absolute top-6 right-6 text-slate-400 font-mono text-[10px] tracking-wider uppercase bg-slate-900/50 px-2.5 py-1 rounded border border-slate-800/40">
          EDGE_FPS: {isPaused ? 'FREEZE' : (inferenceFps > 0 ? inferenceFps : '--')}
        </div>
      </div>

      {isPaused && !camError && !modelLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full flex items-center gap-2 z-30 animate-pulse text-yellow-400 text-xs font-mono font-bold tracking-widest">
          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
          INFERENCE SCAN PAUSED
        </div>
      )}

      {!camError && !modelLoading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-4 z-30 pointer-events-auto max-w-[95%] sm:max-w-xl">
          
          {settings.videoSource === 'webcam' && videoDevices.length > 1 && (
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <select 
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-slate-950 text-slate-350 text-xs rounded-lg border border-slate-800/80 px-2 py-1 focus:outline-none focus:border-green-500 cursor-pointer font-sans max-w-[130px] sm:max-w-[180px]"
              >
                {videoDevices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {settings.videoSource === 'cctv' && (
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3 text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
              CCTV CONNECTED
            </div>
          )}

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-2 rounded-xl transition-all border ${
              isPaused 
                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20' 
                : 'bg-slate-950 border-slate-850 text-slate-350 hover:bg-slate-800/60 hover:text-green-400 hover:border-green-500/30'
            }`}
            title={isPaused ? "Resume Object Detection" : "Pause Object Detection"}
          >
            {isPaused ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => updateSettings({ voiceAnnounce: !settings.voiceAnnounce })}
            className={`p-2 rounded-xl transition-all border ${
              !settings.voiceAnnounce 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-450 hover:bg-rose-500/20' 
                : 'bg-slate-950 border-slate-850 text-slate-355 hover:bg-slate-800/60 hover:text-green-400 hover:border-green-500/30'
            }`}
            title={settings.voiceAnnounce ? "Mute Voice Alerts" : "Unmute Voice Alerts"}
          >
            {settings.voiceAnnounce ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          <button
            onClick={captureSnapshot}
            className="p-2 bg-slate-950 border border-slate-850 text-slate-355 rounded-xl hover:bg-slate-800/60 hover:text-green-455 hover:border-green-500/30 transition-all"
            title="Capture HUD Snapshot (PNG)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {history.length > 0 && (
            <button
              onClick={exportLogData}
              className="p-2 bg-slate-950 border border-slate-850 text-slate-355 rounded-xl hover:bg-slate-800/60 hover:text-green-455 hover:border-green-500/30 transition-all"
              title="Download Logs (JSON)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}

        </div>
      )}
    </div>
  );
};

export default CameraView;
