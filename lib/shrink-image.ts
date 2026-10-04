import { MAX_FILE_BYTES } from "./upload-limits";

// Downscale an image in the browser until it fits under MAX_FILE_BYTES.
// Files already small enough are returned untouched. PNGs stay PNG so
// transparency (e.g. cut-out clothing) is preserved; everything else becomes JPEG.
export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= MAX_FILE_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const ext = type === "image/png" ? "png" : "jpg";

  try {
    let maxSide = Math.min(2048, Math.max(bitmap.width, bitmap.height));
    while (maxSide >= 256) {
      const scale = maxSide / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
      if (blob && blob.size <= MAX_FILE_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type });
      }
      maxSide = Math.round(maxSide * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error("This image is too large. Please use a smaller image.");
}
