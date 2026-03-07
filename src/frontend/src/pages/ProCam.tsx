import { Slider } from "@/components/ui/slider";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  FlipHorizontal,
  Focus,
  Grid3x3,
  Images,
  Lightbulb,
  RefreshCcw,
  Settings,
  Sun,
  Timer,
  Trash2,
  X,
  Zap,
  ZapOff,
  ZoomIn,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCamera } from "../camera/useCamera";

// ─── Types ───────────────────────────────────────────────────────────────────

type FlashMode = "off" | "auto" | "on";
type TimerMode = 0 | 3 | 10;
type WhiteBalance =
  | "auto"
  | "daylight"
  | "cloudy"
  | "tungsten"
  | "fluorescent"
  | "flash";
type FocusMode = "AF" | "MF";
type ResolutionMode = "720p" | "1080p" | "4K";
type ISOValue = "AUTO" | "100" | "200" | "400" | "800" | "1600" | "3200";

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: Date;
  width: number;
  height: number;
  file: File;
}

interface FocusPoint {
  x: number;
  y: number;
  id: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WB_OPTIONS: {
  value: WhiteBalance;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "auto",
    label: "AWB",
    icon: <span className="text-[10px] font-bold">A</span>,
  },
  { value: "daylight", label: "Sun", icon: <Sun size={12} /> },
  { value: "cloudy", label: "Cloud", icon: <Cloud size={12} /> },
  { value: "tungsten", label: "Bulb", icon: <Lightbulb size={12} /> },
  {
    value: "fluorescent",
    label: "Fluor",
    icon: <span className="text-[10px] font-bold">F</span>,
  },
  { value: "flash", label: "Flash", icon: <Zap size={12} /> },
];

const ISO_VALUES: ISOValue[] = [
  "AUTO",
  "100",
  "200",
  "400",
  "800",
  "1600",
  "3200",
];
const RESOLUTION_OPTIONS: ResolutionMode[] = ["720p", "1080p", "4K"];

// ─── Shutter sound synthesizer ───────────────────────────────────────────────

function playShutterSound() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      200,
      ctx.currentTime + 0.1,
    );
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 300);
  } catch {
    // Audio not available
  }
}

// ─── RGB Histogram ───────────────────────────────────────────────────────────

function Histogram({
  videoRef,
}: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animId = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Sample video frame
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = 64;
      tmpCanvas.height = 36;
      const tmpCtx = tmpCanvas.getContext("2d");
      if (!tmpCtx) return;
      tmpCtx.drawImage(video, 0, 0, 64, 36);
      const imageData = tmpCtx.getImageData(0, 0, 64, 36);
      const data = imageData.data;

      const r = new Array(32).fill(0);
      const g = new Array(32).fill(0);
      const b = new Array(32).fill(0);

      for (let i = 0; i < data.length; i += 4) {
        r[Math.floor(data[i] / 8)]++;
        g[Math.floor(data[i + 1] / 8)]++;
        b[Math.floor(data[i + 2] / 8)]++;
      }

      const maxVal = Math.max(...r, ...g, ...b, 1);
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, W, H);

      const drawChannel = (values: number[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        values.forEach((v, i) => {
          const x = (i / 32) * W;
          const y = H - (v / maxVal) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };

      drawChannel(r, "rgba(255,80,80,0.7)");
      drawChannel(g, "rgba(80,255,120,0.7)");
      drawChannel(b, "rgba(80,140,255,0.7)");

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={36}
      className="rounded opacity-90"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ─── Level Indicator ─────────────────────────────────────────────────────────

function LevelIndicator() {
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        setTilt(Math.max(-30, Math.min(30, e.gamma)));
      }
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const isLevel = Math.abs(tilt) < 2;

  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className="relative w-16 h-1.5 rounded-full"
        style={{ background: "rgba(255,255,255,0.15)" }}
      >
        <div
          className="level-bubble absolute top-0 h-full w-4 rounded-full transition-all"
          style={{
            left: `calc(50% + ${(tilt / 30) * 24}px - 8px)`,
            background: isLevel
              ? "oklch(0.78 0.17 65)"
              : "oklch(0.9 0.01 240 / 0.7)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

function Gallery({
  photos,
  onClose,
  onDelete,
}: {
  photos: CapturedPhoto[];
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selected = selectedIndex !== null ? photos[selectedIndex] : null;

  const downloadPhoto = (photo: CapturedPhoto) => {
    const a = document.createElement("a");
    a.href = photo.dataUrl;
    a.download = `ProCam_${photo.timestamp.toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "oklch(0.05 0.004 240)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cam-glass border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="font-medium text-sm">Back</span>
        </button>
        <span className="text-white font-semibold text-sm">
          Gallery ({photos.length})
        </span>
        <div className="w-16" />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
            <Camera size={48} strokeWidth={1} />
            <p className="text-sm">No captures yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map((photo, i) => (
              <button
                type="button"
                key={photo.id}
                onClick={() => setSelectedIndex(i)}
                className="aspect-square overflow-hidden rounded relative group"
                aria-label={`View capture ${i + 1}`}
              >
                <img
                  src={photo.dataUrl}
                  alt={`Capture ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen viewer */}
      <AnimatePresence>
        {selected && selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col"
            style={{ background: "oklch(0.04 0.003 240)", zIndex: 60 }}
          >
            {/* Viewer header */}
            <div className="flex items-center justify-between px-4 py-3 cam-glass border-b border-white/10">
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="text-white/80 hover:text-white"
                aria-label="Close viewer"
              >
                <X size={20} />
              </button>
              <span className="text-white/70 text-xs font-mono">
                {selected.width}×{selected.height}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadPhoto(selected)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                  aria-label="Download"
                >
                  <Download size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(selected.id);
                    if (selectedIndex >= photos.length - 1) {
                      setSelectedIndex(Math.max(0, selectedIndex - 1));
                    }
                    if (photos.length <= 1) setSelectedIndex(null);
                  }}
                  className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Full image */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
              <img
                src={selected.dataUrl}
                alt="Full size view"
                className="max-w-full max-h-full object-contain"
              />
              {/* Nav arrows */}
              {selectedIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(selectedIndex - 1)}
                  className="absolute left-3 p-2 cam-glass rounded-full text-white hover:bg-white/20 transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {selectedIndex < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(selectedIndex + 1)}
                  className="absolute right-3 p-2 cam-glass rounded-full text-white hover:bg-white/20 transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Info bar */}
            <div className="px-4 py-2 cam-glass border-t border-white/10">
              <p className="text-white/50 text-xs text-center">
                {selected.timestamp.toLocaleString()} · PNG
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main ProCam Component ────────────────────────────────────────────────────

export default function ProCam() {
  // Camera hook
  const {
    isActive,
    isSupported,
    error,
    isLoading,
    startCamera,
    switchCamera,
    capturePhoto,
    videoRef,
    canvasRef,
    currentFacingMode,
  } = useCamera({
    facingMode: "environment",
    width: 3840,
    height: 2160,
    quality: 1,
    format: "image/png",
  });

  // UI State
  const [flash, setFlash] = useState<FlashMode>("off");
  const [timer, setTimer] = useState<TimerMode>(0);
  const [gridOn, setGridOn] = useState(false);
  const [whiteBalance, setWhiteBalance] = useState<WhiteBalance>("auto");
  const [iso, setIso] = useState<ISOValue>("AUTO");
  const [ev, setEv] = useState(0);
  const [focusMode, setFocusMode] = useState<FocusMode>("AF");
  const [resolution, setResolution] = useState<ResolutionMode>("4K");
  const [zoom, setZoom] = useState(1);
  const [showHistogram, setShowHistogram] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);

  // Capture state
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [focusPoints, setFocusPoints] = useState<FocusPoint[]>([]);

  // Pinch zoom
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  // Start camera once browser support is confirmed (or on mount if already known)
  // biome-ignore lint/correctness/useExhaustiveDependencies: startCamera is intentionally excluded to avoid re-triggering on every render
  useEffect(() => {
    if (isSupported === false) return;
    startCamera();
  }, [isSupported]);

  const doCapture = useCallback(async () => {
    setIsCapturing(true);
    setShowFlash(true);
    playShutterSound();

    setTimeout(() => setShowFlash(false), 350);

    try {
      const file = await capturePhoto();
      if (file) {
        const dataUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const photoEntry: CapturedPhoto = {
            id: crypto.randomUUID(),
            dataUrl,
            timestamp: new Date(),
            width: img.naturalWidth || 1920,
            height: img.naturalHeight || 1080,
            file,
          };
          setPhotos((prev) => [photoEntry, ...prev]);
          toast.success("Captured!", { duration: 1500 });
        };
        img.src = dataUrl;
      }
    } catch (_err) {
      toast.error("Failed to capture");
    } finally {
      setIsCapturing(false);
    }
  }, [capturePhoto]);

  // Capture handler
  const handleCapture = useCallback(async () => {
    if (!isActive || isCapturing) return;

    if (timer > 0) {
      setCountdown(timer);
      let count = timer;
      const interval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(interval);
          setCountdown(null);
          doCapture();
        } else {
          setCountdown(count);
        }
      }, 1000);
      return;
    }

    doCapture();
  }, [isActive, isCapturing, timer, doCapture]);

  // Tap to focus
  const handleViewfinderTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (focusMode !== "MF") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const id = Date.now();
      setFocusPoints((prev) => [...prev.slice(-2), { x, y, id }]);
      setTimeout(() => {
        setFocusPoints((prev) => prev.filter((p) => p.id !== id));
      }, 900);
    },
    [focusMode],
  );

  const handleViewfinderKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        handleCapture();
      }
    },
    [handleCapture],
  );

  // Pinch to zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartZoom.current = zoom;
      }
    },
    [zoom],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchStartDist.current;
      const newZoom = Math.max(
        0.5,
        Math.min(50, pinchStartZoom.current * scale),
      );
      setZoom(newZoom);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStartDist.current = null;
  }, []);

  const deletePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.dataUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const isDesktop = window.innerWidth >= 768;
  const lastPhoto = photos[0];

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isSupported === false) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-sm">
          <Camera
            size={64}
            className="mx-auto mb-4 text-white/30"
            strokeWidth={1}
          />
          <h2 className="text-xl font-semibold mb-2">Camera Not Supported</h2>
          <p className="text-white/50 text-sm">
            Your browser doesn't support camera access. Try Chrome or Safari.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-sm">
          <Camera
            size={64}
            className="mx-auto mb-4 text-red-400/60"
            strokeWidth={1}
          />
          <h2 className="text-xl font-semibold mb-2 text-red-300">
            {error.type === "permission"
              ? "Camera Permission Denied"
              : "Camera Error"}
          </h2>
          <p className="text-white/50 text-sm mb-6">{error.message}</p>
          {error.type === "permission" && (
            <p className="text-white/40 text-xs mb-6">
              Allow camera access in your browser settings, then refresh the
              page.
            </p>
          )}
          <button
            type="button"
            onClick={() => startCamera()}
            className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: "oklch(0.78 0.17 65)",
              color: "oklch(0.06 0.005 240)",
            }}
          >
            <RefreshCcw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      {/* ── Canvas (hidden, used by useCamera) ── */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Viewfinder ── */}
      <div
        ref={viewfinderRef}
        className="absolute inset-0 overflow-hidden"
        onClick={handleViewfinderTap}
        onKeyDown={handleViewfinderKey}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: focusMode === "MF" ? "crosshair" : "default" }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full"
          style={{
            objectFit: "cover",
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            display: "block",
            minWidth: "100%",
            minHeight: "100%",
          }}
        />

        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60"
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border-2 border-white/20 animate-spin"
                  style={{ borderTopColor: "oklch(0.78 0.17 65)" }}
                />
                <span className="text-white/60 text-sm">
                  Initializing camera…
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rule-of-thirds grid */}
        <AnimatePresence>
          {gridOn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)
                `,
                  backgroundSize: "33.33% 33.33%",
                }}
              />
              <div
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{ background: "rgba(255,255,255,0.4)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Focus points */}
        {focusPoints.map((fp) => (
          <div
            key={fp.id}
            className="absolute pointer-events-none focus-square"
            style={{
              left: `${fp.x}%`,
              top: `${fp.y}%`,
              transform: "translate(-50%, -50%)",
              width: 60,
              height: 60,
              border: "2px solid oklch(0.78 0.17 65)",
            }}
          />
        ))}

        {/* Flash overlay */}
        <AnimatePresence>
          {showFlash && (
            <div className="absolute inset-0 bg-white flash-overlay pointer-events-none" />
          )}
        </AnimatePresence>

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              <span
                className="countdown-text text-white font-bold"
                style={{
                  fontSize: "clamp(80px, 20vw, 160px)",
                  textShadow: "0 4px 40px rgba(0,0,0,0.8)",
                }}
              >
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Top Control Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-10 cam-glass">
        <div className="flex items-center justify-between px-3 py-2 gap-2">
          {/* Flash */}
          <button
            type="button"
            onClick={() =>
              setFlash((f) =>
                f === "off" ? "auto" : f === "auto" ? "on" : "off",
              )
            }
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background:
                flash !== "off" ? "oklch(0.78 0.17 65 / 0.2)" : "transparent",
              color:
                flash !== "off"
                  ? "oklch(0.78 0.17 65)"
                  : "rgba(255,255,255,0.7)",
              border:
                flash !== "off"
                  ? "1px solid oklch(0.78 0.17 65 / 0.4)"
                  : "1px solid transparent",
            }}
            aria-label="Toggle flash"
          >
            {flash === "off" ? <ZapOff size={15} /> : <Zap size={15} />}
            <span className="hidden sm:inline">{flash.toUpperCase()}</span>
          </button>

          {/* Timer */}
          <button
            type="button"
            onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background:
                timer > 0 ? "oklch(0.78 0.17 65 / 0.2)" : "transparent",
              color:
                timer > 0 ? "oklch(0.78 0.17 65)" : "rgba(255,255,255,0.7)",
              border:
                timer > 0
                  ? "1px solid oklch(0.78 0.17 65 / 0.4)"
                  : "1px solid transparent",
            }}
            aria-label="Toggle timer"
          >
            <Timer size={15} />
            <span>{timer === 0 ? "Off" : `${timer}s`}</span>
          </button>

          {/* Grid */}
          <button
            type="button"
            onClick={() => setGridOn((g) => !g)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: gridOn ? "oklch(0.78 0.17 65 / 0.2)" : "transparent",
              color: gridOn ? "oklch(0.78 0.17 65)" : "rgba(255,255,255,0.7)",
              border: gridOn
                ? "1px solid oklch(0.78 0.17 65 / 0.4)"
                : "1px solid transparent",
            }}
            aria-label="Toggle grid"
          >
            <Grid3x3 size={15} />
            <span className="hidden sm:inline">Grid</span>
          </button>

          {/* White Balance */}
          <div className="flex items-center gap-1">
            {WB_OPTIONS.map((wb) => (
              <button
                type="button"
                key={wb.value}
                onClick={() => setWhiteBalance(wb.value)}
                title={wb.label}
                aria-label={`White balance: ${wb.label}`}
                className="w-6 h-6 flex items-center justify-center rounded-full text-xs transition-all"
                style={{
                  background:
                    whiteBalance === wb.value
                      ? "oklch(0.78 0.17 65)"
                      : "rgba(255,255,255,0.1)",
                  color:
                    whiteBalance === wb.value
                      ? "oklch(0.06 0.005 240)"
                      : "rgba(255,255,255,0.7)",
                }}
              >
                {wb.icon}
              </button>
            ))}
          </div>

          {/* Histogram toggle */}
          <button
            type="button"
            onClick={() => setShowHistogram((h) => !h)}
            className="px-2 py-1 rounded-full text-xs transition-all"
            style={{
              background: showHistogram
                ? "oklch(0.78 0.17 65 / 0.2)"
                : "transparent",
              color: showHistogram
                ? "oklch(0.78 0.17 65)"
                : "rgba(255,255,255,0.5)",
              border: showHistogram
                ? "1px solid oklch(0.78 0.17 65 / 0.4)"
                : "1px solid transparent",
            }}
            aria-label="Toggle histogram"
          >
            <span className="text-[10px] font-mono font-bold">HIST</span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* ProCam label */}
          <span
            className="text-white/90 font-bold text-sm tracking-widest hidden sm:block"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            PRO<span style={{ color: "oklch(0.78 0.17 65)" }}>CAM</span>
          </span>

          {/* Settings toggle */}
          <button
            type="button"
            onClick={() => setShowSidePanel((s) => !s)}
            className="p-1.5 rounded-full text-white/70 hover:text-white transition-colors"
            aria-label="Toggle settings panel"
          >
            <Settings size={17} />
          </button>
        </div>

        {/* Histogram bar */}
        <AnimatePresence>
          {showHistogram && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-3 pb-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-[10px] font-mono">RGB</span>
                <Histogram videoRef={videoRef} />
                <div className="flex flex-col gap-0.5 ml-2">
                  <LevelIndicator />
                  <span className="text-white/40 text-[9px] text-center">
                    LEVEL
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right Side Panel ── */}
      <AnimatePresence>
        {showSidePanel && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 z-20 flex flex-col py-16 px-2 gap-3 cam-glass"
            style={{ width: 88, borderLeft: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* ISO */}
            <div className="flex flex-col gap-1">
              <span className="text-white/40 text-[9px] text-center tracking-widest">
                ISO
              </span>
              <div className="flex flex-col gap-0.5">
                {ISO_VALUES.map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setIso(val)}
                    className="py-1 rounded text-[10px] font-mono font-semibold transition-all"
                    style={{
                      background:
                        iso === val ? "oklch(0.78 0.17 65)" : "transparent",
                      color:
                        iso === val
                          ? "oklch(0.06 0.005 240)"
                          : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* EV */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-white/40 text-[9px] tracking-widest">
                EV
              </span>
              <div className="h-36 flex items-center justify-center">
                <Slider
                  orientation="vertical"
                  min={-3}
                  max={3}
                  step={0.3}
                  value={[ev]}
                  onValueChange={([v]) => setEv(v)}
                  className="h-full"
                />
              </div>
              <span
                className="text-[10px] font-mono font-semibold"
                style={{
                  color:
                    ev === 0 ? "rgba(255,255,255,0.5)" : "oklch(0.78 0.17 65)",
                }}
              >
                {ev >= 0 ? "+" : ""}
                {ev.toFixed(1)}
              </span>
            </div>

            <div className="h-px bg-white/10" />

            {/* Focus mode */}
            <div className="flex flex-col gap-1">
              <span className="text-white/40 text-[9px] text-center tracking-widest">
                FOCUS
              </span>
              <div className="flex flex-col gap-0.5">
                {(["AF", "MF"] as FocusMode[]).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setFocusMode(mode)}
                    className="py-1 rounded text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-all"
                    style={{
                      background:
                        focusMode === mode
                          ? "oklch(0.78 0.17 65)"
                          : "transparent",
                      color:
                        focusMode === mode
                          ? "oklch(0.06 0.005 240)"
                          : "rgba(255,255,255,0.55)",
                    }}
                  >
                    <Focus size={10} />
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Resolution */}
            <div className="flex flex-col gap-1">
              <span className="text-white/40 text-[9px] text-center tracking-widest">
                RES
              </span>
              <div className="flex flex-col gap-0.5">
                {RESOLUTION_OPTIONS.map((res) => (
                  <button
                    type="button"
                    key={res}
                    onClick={() => setResolution(res)}
                    className="py-1 rounded text-[10px] font-mono font-semibold transition-all"
                    style={{
                      background:
                        resolution === res
                          ? "oklch(0.78 0.17 65)"
                          : "transparent",
                      color:
                        resolution === res
                          ? "oklch(0.06 0.005 240)"
                          : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Control Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 cam-glass">
        {/* Zoom bar */}
        <div className="flex items-center justify-center gap-2 px-4 pt-2">
          <ZoomIn size={13} className="text-white/40" />
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <Slider
              min={0.5}
              max={50}
              step={0.5}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
          </div>
          <span className="text-white/50 text-xs font-mono w-10">
            {zoom >= 10 ? `${zoom.toFixed(0)}x` : `${zoom.toFixed(1)}x`}
          </span>
          {/* Quick zoom presets */}
          {[1, 2, 5, 10, 20, 50].map((z) => (
            <button
              type="button"
              key={z}
              onClick={() => setZoom(z)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded transition-all"
              aria-label={`Zoom ${z}x`}
              style={{
                background:
                  Math.abs(zoom - z) < 0.3
                    ? "oklch(0.78 0.17 65)"
                    : "rgba(255,255,255,0.1)",
                color:
                  Math.abs(zoom - z) < 0.3
                    ? "oklch(0.06 0.005 240)"
                    : "rgba(255,255,255,0.6)",
              }}
            >
              {z}x
            </button>
          ))}
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Thumbnail / Gallery button */}
          <button
            type="button"
            onClick={() => setShowGallery(true)}
            className="relative w-14 h-14 rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95"
            aria-label="Open gallery"
            style={{
              border: "2px solid rgba(255,255,255,0.2)",
              background: lastPhoto ? "transparent" : "rgba(255,255,255,0.05)",
            }}
          >
            {lastPhoto ? (
              <img
                src={lastPhoto.dataUrl}
                alt="Most recent capture"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Images size={22} className="text-white/30" />
              </div>
            )}
            {photos.length > 0 && (
              <div
                className="absolute bottom-0.5 right-0.5 text-[9px] font-bold px-1 rounded"
                style={{
                  background: "oklch(0.78 0.17 65)",
                  color: "oklch(0.06 0.005 240)",
                }}
              >
                {photos.length}
              </div>
            )}
          </button>

          {/* Shutter */}
          <button
            type="button"
            onClick={handleCapture}
            disabled={!isActive || isCapturing || countdown !== null}
            className="shutter-btn"
            aria-label="Capture"
            style={{
              opacity: !isActive || isCapturing || countdown !== null ? 0.4 : 1,
            }}
          >
            <div
              className="absolute inset-2 rounded-full"
              style={{
                background: isCapturing
                  ? "oklch(0.78 0.17 65)"
                  : "rgba(255,255,255,0.95)",
              }}
            />
          </button>

          {/* Camera flip (mobile only) */}
          {!isDesktop ? (
            <button
              type="button"
              onClick={() =>
                switchCamera(
                  currentFacingMode === "environment" ? "user" : "environment",
                )
              }
              disabled={!isActive || isLoading}
              className="w-14 h-14 flex items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "2px solid rgba(255,255,255,0.15)",
                opacity: !isActive || isLoading ? 0.4 : 1,
              }}
              aria-label="Switch camera"
            >
              <FlipHorizontal size={22} className="text-white/80" />
            </button>
          ) : (
            <div className="w-14" />
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-center gap-3 pb-2 px-4">
          <span className="text-white/30 text-[9px] font-mono uppercase tracking-widest">
            {resolution}
          </span>
          <span className="text-white/20 text-[9px]">·</span>
          <span className="text-white/30 text-[9px] font-mono uppercase">
            ISO {iso}
          </span>
          <span className="text-white/20 text-[9px]">·</span>
          <span className="text-white/30 text-[9px] font-mono">
            WB {whiteBalance.toUpperCase()}
          </span>
          <span className="text-white/20 text-[9px]">·</span>
          <span
            className="text-[9px] font-mono"
            style={{
              color:
                focusMode === "MF"
                  ? "oklch(0.78 0.17 65 / 0.8)"
                  : "rgba(255,255,255,0.3)",
            }}
          >
            {focusMode}
          </span>
          {flash !== "off" && (
            <>
              <span className="text-white/20 text-[9px]">·</span>
              <Zap size={9} style={{ color: "oklch(0.78 0.17 65 / 0.8)" }} />
            </>
          )}
        </div>
      </div>

      {/* ── Gallery overlay ── */}
      <AnimatePresence>
        {showGallery && (
          <Gallery
            photos={photos}
            onClose={() => setShowGallery(false)}
            onDelete={deletePhoto}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
