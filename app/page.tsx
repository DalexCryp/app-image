"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { shrinkImage } from "@/lib/shrink-image";
import { ALLOWED_TYPES } from "@/lib/upload-limits";

// MIME types plus extensions: some OS file pickers only match on extension.
const ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export default function Home() {
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);
  const [preview1, setPreview1] = useState<string | null>(null);
  const [preview2, setPreview2] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track every object URL we create so they can be revoked on unmount.
  const urls = useRef({ preview1, preview2, resultImage });
  urls.current = { preview1, preview2, resultImage };
  useEffect(
    () => () => {
      Object.values(urls.current).forEach((u) => u && URL.revokeObjectURL(u));
    },
    [],
  );

  function selectFile(
    file: File | null,
    setFile: (f: File | null) => void,
    oldPreview: string | null,
    setPreview: (p: string | null) => void,
  ) {
    if (file && !(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      setError("Only PNG, JPEG and WebP images are allowed.");
      return;
    }
    setError(null);
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    setFile(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!image1 || !image2) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image1", await shrinkImage(image1));
      formData.append("image2", await shrinkImage(image2));

      // Goes through our own API route, which holds the webhook URL server-side.
      // No Content-Type header: the browser sets the multipart boundary itself.
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `The server responded with an error (${response.status}). Please try again.`);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("The server did not return an image.");
      }

      if (resultImage) URL.revokeObjectURL(resultImage);
      setResultImage(URL.createObjectURL(blob));
    } catch (err) {
      if (err instanceof TypeError) {
        setError("Could not reach the server. Please check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const canGenerate = !!image1 && !!image2 && !isLoading;

  return (
    <div className="min-h-screen">
      {/* Announcement bar */}
      <div className="bg-navy px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
        AI virtual try-on · upload two photos to get started
      </div>

      {/* Header */}
      <header className="border-b border-neutral-200">
        <div className="flex items-center justify-center px-4 py-5">
          <span className="text-3xl font-medium uppercase tracking-[0.25em] sm:text-4xl">Fitting Room</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-1 border-t border-neutral-100 px-4 py-3 text-[12px] font-medium uppercase tracking-[0.12em]">
          <span>Try-On</span>
          <span>How it works</span>
          <span className="text-red-500">New</span>
          <span>Tips</span>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        {/* Breadcrumb + title */}
        <div className="mt-10 flex items-center gap-3 text-sm">
          <span>Home</span>
          <span className="text-neutral-400">›</span>
          <span className="text-neutral-400">Virtual Try-On</span>
        </div>
        <h1 className="mt-8 text-4xl font-medium tracking-tight sm:text-5xl">Virtual Try-On</h1>

        <div className="mt-8 flex flex-wrap gap-3">
          {["JPG", "PNG", "WEBP"].map((f) => (
            <span key={f} className="rounded-full border border-neutral-800 px-4 py-1.5 text-sm">
              {f}
            </span>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Action bar */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
            <button
              type="submit"
              disabled={!canGenerate}
              className="flex h-[60px] w-56 items-center justify-between bg-black px-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              {isLoading ? "Generating…" : "Generate"}
              <span aria-hidden>→</span>
            </button>
            <span className="text-sm">
              {[image1, image2].filter(Boolean).length} / 2 images selected
            </span>
          </div>

          {/* Upload + output grid */}
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <UploadCard
              label="Person"
              preview={preview1}
              disabled={isLoading}
              onChange={(f) => selectFile(f, setImage1, preview1, setPreview1)}
            />
            <UploadCard
              label="Clothing"
              preview={preview2}
              disabled={isLoading}
              onChange={(f) => selectFile(f, setImage2, preview2, setPreview2)}
            />

            {/* Output */}
            <section className="relative flex min-h-[420px] flex-col border border-neutral-300 bg-card sm:col-span-2">
              <div className="border-b border-neutral-200 bg-white px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em]">
                Result
              </div>
              <div className="flex flex-1 items-center justify-center p-4">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-black" />
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em]">
                      Generating… this may take up to a minute
                    </p>
                  </div>
                ) : error ? (
                  <div role="alert" className="max-w-sm border border-red-400 bg-red-50 px-5 py-4 text-sm text-red-700">
                    {error}
                  </div>
                ) : resultImage ? (
                  <div className="flex w-full flex-col items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultImage} alt="Generated try-on result" className="max-h-[520px] w-full object-contain" />
                    <a
                      href={resultImage}
                      download="try-on.png"
                      className="border border-black px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-black hover:text-white"
                    >
                      Download
                    </a>
                  </div>
                ) : (
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    Your result will appear here
                  </p>
                )}
              </div>
            </section>
          </div>
        </form>
      </main>
    </div>
  );
}

function UploadCard({
  label,
  preview,
  disabled,
  onChange,
}: {
  label: string;
  preview: string | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }

  return (
    <div className="flex flex-col">
      <div className="relative aspect-[3/4] border border-neutral-300 bg-card">
        <label
          className={`flex h-full w-full cursor-pointer items-center justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={handleChange}
            disabled={disabled}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${label} preview`} className="h-full w-full object-contain p-4" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-neutral-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">Upload {label}</span>
            </div>
          )}
        </label>
        {preview && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Remove ${label} image`}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg leading-none shadow-sm hover:bg-neutral-100"
          >
            ×
          </button>
        )}
      </div>
      <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.12em]">{label}</p>
    </div>
  );
}
