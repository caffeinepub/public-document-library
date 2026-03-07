import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraConfig {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  quality?: number;
  format?: "image/jpeg" | "image/png" | "image/webp";
}

export interface CameraError {
  type: "permission" | "not-supported" | "not-found" | "unknown";
  message: string;
}

export const useCamera = (config: CameraConfig = {}) => {
  const {
    facingMode = "environment",
    width = 1920,
    height = 1080,
    quality = 0.8,
    format = "image/jpeg",
  } = config;

  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  // Use a ref to track loading state to avoid stale closures causing early returns
  const isLoadingRef = useRef(false);

  // Check browser support
  useEffect(() => {
    const supported = !!(
      navigator.mediaDevices?.getUserMedia ||
      (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia
    );
    setIsSupported(supported);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const createMediaStream = useCallback(
    async (facing: "user" | "environment") => {
      // Try with ideal constraints first, then fallback to basic
      const constraintSets = [
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: width },
            height: { ideal: height },
          },
        },
        {
          video: {
            facingMode: facing,
          },
        },
        { video: true },
      ];

      let lastErr: any = null;
      for (const constraints of constraintSets) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          if (!isMountedRef.current) {
            for (const track of stream.getTracks()) {
              track.stop();
            }
            return null;
          }

          return stream;
        } catch (err: any) {
          lastErr = err;
          // Only retry on OverconstrainedError, not on permission errors
          if (
            err.name === "NotAllowedError" ||
            err.name === "SecurityError" ||
            err.name === "NotSupportedError"
          ) {
            break;
          }
        }
      }

      // Map error to CameraError
      let errorType: CameraError["type"] = "unknown";
      let errorMessage = "Failed to access camera";

      if (
        lastErr?.name === "NotAllowedError" ||
        lastErr?.name === "PermissionDeniedError" ||
        lastErr?.name === "SecurityError"
      ) {
        errorType = "permission";
        errorMessage =
          "Camera permission denied. Please allow camera access in your browser settings and try again.";
      } else if (
        lastErr?.name === "NotFoundError" ||
        lastErr?.name === "DevicesNotFoundError"
      ) {
        errorType = "not-found";
        errorMessage = "No camera device found on this device.";
      } else if (lastErr?.name === "NotSupportedError") {
        errorType = "not-supported";
        errorMessage = "Camera is not supported on this browser.";
      } else if (
        lastErr?.name === "NotReadableError" ||
        lastErr?.name === "TrackStartError"
      ) {
        errorType = "unknown";
        errorMessage =
          "Camera is in use by another app. Please close other apps using the camera and try again.";
      }

      throw { type: errorType, message: errorMessage };
    },
    [width, height],
  );

  const setupVideo = useCallback(async (stream: MediaStream) => {
    if (!videoRef.current) return false;

    const video = videoRef.current;
    video.srcObject = stream;

    return new Promise<boolean>((resolve) => {
      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);

        video
          .play()
          .then(() => resolve(true))
          .catch(() => {
            // Autoplay may be blocked -- still resolve true as stream is attached
            resolve(true);
          });
      };

      const onLoaded = () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);

        video
          .play()
          .then(() => resolve(true))
          .catch(() => resolve(true));
      };

      const onError = () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        resolve(false);
      };

      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);

      // If already ready
      if (video.readyState >= 3) {
        onCanPlay();
      } else if (video.readyState >= 1) {
        onLoaded();
      }

      // Timeout fallback -- if no events fire in 5s, resolve true anyway
      setTimeout(() => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        resolve(true);
      }, 5000);
    });
  }, []);

  const startCamera = useCallback(
    async (facingModeOverride?: "user" | "environment"): Promise<boolean> => {
      // Prevent double-start using ref (not state, to avoid stale closures)
      if (isLoadingRef.current) return false;
      if (isSupported === false) return false;

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      const targetFacing = facingModeOverride ?? currentFacingMode;

      try {
        // Stop any existing stream first
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop();
          }
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setIsActive(false);

        const stream = await createMediaStream(targetFacing);
        if (!stream) return false;

        streamRef.current = stream;
        const success = await setupVideo(stream);

        if (isMountedRef.current) {
          if (success) {
            setIsActive(true);
            return true;
          }
          cleanup();
          return false;
        }

        cleanup();
        return false;
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err);
        }
        cleanup();
        return false;
      } finally {
        isLoadingRef.current = false;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isSupported, currentFacingMode, cleanup, createMediaStream, setupVideo],
  );

  const stopCamera = useCallback(async (): Promise<void> => {
    cleanup();
    setError(null);
    isLoadingRef.current = false;
    if (isMountedRef.current) setIsLoading(false);
  }, [cleanup]);

  const switchCamera = useCallback(
    async (newFacingMode?: "user" | "environment"): Promise<boolean> => {
      if (isSupported === false) return false;
      if (isLoadingRef.current) return false;

      const targetFacingMode =
        newFacingMode ||
        (currentFacingMode === "user" ? "environment" : "user");

      setCurrentFacingMode(targetFacingMode);
      return startCamera(targetFacingMode);
    },
    [isSupported, currentFacingMode, startCamera],
  );

  const retry = useCallback(async (): Promise<boolean> => {
    isLoadingRef.current = false;
    cleanup();
    setError(null);
    if (isMountedRef.current) setIsLoading(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return startCamera();
  }, [cleanup, startCamera]);

  const capturePhoto = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current || !isActive) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      // Mirror front camera image
      if (currentFacingMode === "user") {
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0);
      } else {
        ctx.drawImage(video, 0, 0);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const extension = format.split("/")[1];
            const file = new File([blob], `photo_${Date.now()}.${extension}`, {
              type: format,
            });
            resolve(file);
          } else {
            resolve(null);
          }
        },
        format,
        quality,
      );
    });
  }, [isActive, format, quality, currentFacingMode]);

  return {
    // State
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode,

    // Actions
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    retry,

    // Refs for components
    videoRef,
    canvasRef,
  };
};
