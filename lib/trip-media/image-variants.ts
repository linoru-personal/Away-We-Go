/**
 * Client-side downscale + WebP encode for trip-media uploads.
 */

const WEBP_TYPE = "image/webp";
const WEBP_QUALITY = 0.82;

export type ThreeTierImageBlobs = {
  original: Blob;
  preview: Blob;
  thumb: Blob;
};

/** Long-edge caps for hero-style assets (cover + destination). */
export const HERO_WEBP_MAX_SIDES = { original: 1600, preview: 800, thumb: 320 } as const;

/** Long-edge caps for participant avatars. */
export const AVATAR_WEBP_MAX_SIDES = { original: 512, preview: 256, thumb: 96 } as const;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("WebP export not supported in this browser"));
      },
      WEBP_TYPE,
      WEBP_QUALITY
    );
  });
}

/** Fit inside maxSide on the longer edge; preserve aspect ratio. */
function scaleDimensions(
  width: number,
  height: number,
  maxSide: number
): { w: number; h: number } {
  if (width <= 0 || height <= 0) return { w: maxSide, h: maxSide };
  const long = Math.max(width, height);
  if (long <= maxSide) return { w: width, h: height };
  const scale = maxSide / long;
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  };
}

async function renderMaxSide(source: HTMLImageElement, maxSide: number): Promise<Blob> {
  const { w, h } = scaleDimensions(source.naturalWidth, source.naturalHeight, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, w, h);
  return canvasToWebpBlob(canvas);
}

export async function buildWebpVariantsThreeTier(
  source: Blob | File,
  maxSides: { original: number; preview: number; thumb: number }
): Promise<ThreeTierImageBlobs> {
  const img = await loadImage(source);
  const [original, preview, thumb] = await Promise.all([
    renderMaxSide(img, maxSides.original),
    renderMaxSide(img, maxSides.preview),
    renderMaxSide(img, maxSides.thumb),
  ]);
  return { original, preview, thumb };
}

/** Cover + destination hero sizes (1600 / 800 / 320 long edge). */
export async function buildTripCoverWebpVariants(
  source: Blob | File
): Promise<ThreeTierImageBlobs> {
  return buildWebpVariantsThreeTier(source, HERO_WEBP_MAX_SIDES);
}

/** Participant avatar sizes (512 / 256 / 96 long edge). */
export async function buildParticipantAvatarWebpVariants(
  source: Blob | File
): Promise<ThreeTierImageBlobs> {
  return buildWebpVariantsThreeTier(source, AVATAR_WEBP_MAX_SIDES);
}
