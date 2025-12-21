
import React, { useRef, useEffect, useState } from 'react';
import { DetectionResult, Detection, AppSettings } from '../types';
import { COLORS } from '../constants';

interface CameraViewProps {
  onCapture: (base64: string) => void;
  results: DetectionResult | null;
  settings: AppSettings;
  isScanning: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, results, settings, isScanning }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    setupCamera();
  }, []);

  useEffect(() => {
    if (!results || !canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { videoWidth, videoHeight } = videoRef.current!;
      canvasRef.current!.width = videoWidth;
      canvasRef.current!.height = videoHeight;

      ctx.clearRect(0, 0, videoWidth, videoHeight);

      results.detections.forEach((det: Detection) => {
        if (det.confidence < settings.confidenceThreshold) return;

        const { ymin, xmin, ymax, xmax } = det.box_2d;
        
        // Scale from 1000x1000 Gemini coords to actual pixel dims
        const top = (ymin / 1000) * videoHeight;
        const left = (xmin / 1000) * videoWidth;
        const height = ((ymax - ymin) / 1000) * videoHeight;
        const width = ((xmax - xmin) / 1000) * videoWidth;

        // Choose color based on status
        let color = COLORS.primary;
        if (det.status === 'low-stock' || det.status === 'suspicious') color = COLORS.danger;
        else if (det.confidence < 0.7) color = COLORS.warning;

        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(left, top, width, height);

        // Label Background
        ctx.fillStyle = color;
        const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(left, top - 25, textWidth + 10, 25);

        // Label Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Inter';
        ctx.fillText(label, left + 5, top - 7);
      });
    };

    render();
  }, [results, settings.confidenceThreshold]);

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      onCapture(base64);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-full h-full object-cover"
      />
      
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full object-cover z-20 pointer-events-none"
      />

      {isScanning && <div className="scanline"></div>}

      <div className="absolute inset-0 pointer-events-none border-[16px] border-black/20 z-10"></div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-4">
        <button
          onClick={captureFrame}
          disabled={!isReady || isScanning}
          className={`px-8 py-4 rounded-full font-bold text-white shadow-2xl transition-all flex items-center gap-2 ${
            isScanning ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500 scale-100 active:scale-95'
          }`}
        >
          {isScanning ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </span>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scan Environment
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CameraView;
