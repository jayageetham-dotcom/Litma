"use client";
/** Resize an image file in the browser and re-encode as WebP. `square` centre-crops. */
export async function resizeImage(file: File, maxSide = 1600, square = false, quality = 0.86): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG, WebP or GIF).");
  const bmp = await createImageBitmap(file);
  let sx = 0,
    sy = 0,
    sw = bmp.width,
    sh = bmp.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that image."))), "image/webp", quality));
}
