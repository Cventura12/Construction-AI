"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

type RecorderStatus = "idle" | "recording" | "uploading" | "success";

const uploadResponseSchema = z.object({
  signedUrl: z.string().url(),
  reportId: z.string().min(1),
});

const formatTimer = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const getSupportedMimeType = (): string | null => {
  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mpeg"];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
};

const getFriendlyError = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access was denied. Please allow microphone permission and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};

const uploadAudio = async (audioBlob: Blob): Promise<string> => {
  const extension = audioBlob.type.includes("mpeg") ? "mp3" : "webm";
  const fileName = `report-${Date.now()}.${extension}`;
  const fileType = audioBlob.type || "audio/webm";

  const uploadSessionRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, fileType }),
  });

  if (!uploadSessionRes.ok) {
    throw new Error("Could not start upload. Check your signal and try again.");
  }

  const uploadSessionData = await uploadSessionRes.json();
  const parsedUploadSession = uploadResponseSchema.safeParse(uploadSessionData);
  if (!parsedUploadSession.success) {
    throw new Error("Upload session response was invalid.");
  }

  const { signedUrl, reportId } = parsedUploadSession.data;

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": fileType },
    body: audioBlob,
  });

  if (!uploadRes.ok) {
    throw new Error("Upload failed. Please try recording again.");
  }

  return reportId;
};

const triggerReportProcessing = (reportId: string): void => {
  const payload = JSON.stringify({ reportId });

  // Fire-and-forget so we can move the user to review immediately.
  void fetch("/api/reports/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch((error) => {
    console.error("Failed to trigger report processing.", error);
  });
};

const Recorder = () => {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isRecording = status === "recording";

  const isBusy = useMemo(
    () => status === "recording" || status === "uploading",
    [status],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    clearTimer();
    stopTracks();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, [clearTimer, stopTracks]);

  const startRecording = useCallback(async () => {
    if (isBusy) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Your browser does not support microphone recording.");
      return;
    }
    if (typeof window.MediaRecorder === "undefined") {
      setErrorMessage("MediaRecorder is not available in this browser.");
      return;
    }

    try {
      setErrorMessage(null);
      setElapsedSeconds(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setErrorMessage("Recording encountered an error. Please try again.");
        setStatus("idle");
        resetSession();
      };

      recorder.onstop = async () => {
        clearTimer();
        stopTracks();

        try {
          const blobType = recorder.mimeType || "audio/webm";
          const audioBlob = new Blob(chunksRef.current, { type: blobType });
          chunksRef.current = [];

          if (!audioBlob.size) {
            throw new Error("No audio captured. Please try recording again.");
          }

          const reportId = await uploadAudio(audioBlob);
          triggerReportProcessing(reportId);
          setStatus("success");
          router.push(`/reports/${reportId}`);
        } catch (error) {
          setStatus("idle");
          setErrorMessage(getFriendlyError(error));
        } finally {
          mediaRecorderRef.current = null;
        }
      };

      recorder.start();
      setStatus("recording");

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (error) {
      resetSession();
      setStatus("idle");
      setErrorMessage(getFriendlyError(error));
    }
  }, [clearTimer, isBusy, resetSession, router, stopTracks]);

  const stopAndUpload = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || status !== "recording") return;

    setStatus("uploading");
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [status]);

  const handleMainButtonClick = useCallback(() => {
    if (status === "uploading") return;
    if (status === "recording") {
      stopAndUpload();
      return;
    }
    void startRecording();
  }, [startRecording, status, stopAndUpload]);

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-hammer-concrete p-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black uppercase tracking-tight text-hammer-navy">
          HammerVoice
        </h1>
        <p className="font-medium text-slate-500">Chattanooga Site A • Daily Log</p>
      </div>

      <button
        type="button"
        onClick={handleMainButtonClick}
        disabled={status === "uploading"}
        className={`relative flex h-48 w-48 flex-col items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 ${
          isRecording
            ? "scale-110 bg-red-600 shadow-red-200"
            : "bg-hammer-orange hover:bg-orange-600 active:scale-95"
        } disabled:cursor-not-allowed disabled:opacity-80`}
      >
        {isRecording ? (
          <span className="absolute inset-0 rounded-full bg-red-600 opacity-25 animate-ping" />
        ) : null}

        <div className="z-10 flex flex-col items-center">
          <span className="text-lg font-bold uppercase tracking-widest">
            {status === "uploading" ? "Loading" : isRecording ? "Stop" : "Start"}
          </span>
          <span className="text-xs uppercase opacity-80">
            {status === "uploading" ? "AI" : "Report"}
          </span>
        </div>
      </button>

      <div className="mt-12 w-full max-w-sm space-y-3">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                isRecording
                  ? "animate-pulse bg-red-500"
                  : status === "uploading"
                    ? "animate-pulse bg-amber-500"
                    : "bg-slate-300"
              }`}
            />
            <p className="text-sm font-bold uppercase text-slate-700">
              {status === "uploading"
                ? "Loading AI..."
                : isRecording
                  ? `Recording • ${formatTimer(elapsedSeconds)}`
                  : "Ready to record"}
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-lg border-2 border-red-800 bg-red-100 px-3 py-2 text-sm font-semibold text-red-900">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default Recorder;
