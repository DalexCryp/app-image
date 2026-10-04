// Shared by the client (pre-upload resizing) and the API route (validation).
// Vercel functions reject request bodies over 4.5 MB, so two images must fit well under that.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
