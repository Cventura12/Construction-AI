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

const Recorder = () => {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border-4 border-black bg-white p-4 shadow-[0_8px_0_#000]">
      <h2 className="text-center text-xl font-black uppercase tracking-wide text-black">
        Field Recorder
      </h2>

      <div className="mt-4 rounded-xl border-2 border-black bg-black px-4 py-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-300">
          Timer
        </p>
        <p className="mt-1 text-4xl font-black tabular-nums text-lime-300">
          {formatTimer(elapsedSeconds)}
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border-2 border-red-800 bg-red-100 px-3 py-2 text-sm font-semibold text-red-900">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={startRecording}
          disabled={status === "recording" || status === "uploading"}
          className="min-h-16 rounded-xl border-2 border-black bg-red-600 px-4 py-3 text-lg font-black text-white shadow-[0_5px_0_#000] transition active:translate-y-[2px] active:shadow-[0_3px_0_#000] disabled:cursor-not-allowed disabled:bg-red-300"
        >
          {status === "recording" ? "Recording..." : "Start Recording"}
        </button>

        <button
          type="button"
          onClick={stopAndUpload}
          disabled={status !== "recording"}
          className="min-h-16 rounded-xl border-2 border-black bg-zinc-900 px-4 py-3 text-lg font-black text-white shadow-[0_5px_0_#000] transition active:translate-y-[2px] active:shadow-[0_3px_0_#000] disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          Stop &amp; Generate Report
        </button>
      </div>

      {status === "uploading" ? (
        <p className="mt-4 text-center text-base font-extrabold text-black">
          Processing...
        </p>
      ) : null}
    </section>
  );
};

export default Recorder;
