/**
 * Client-side downscale + WebP encode for trip cover uploads.
 */

const WEBP_TYPE = "image/webp";
const WEBP_QUALITY = 0.82;

export type CoverImageVariantBlobs = {
  original: Blob;
  preview: Blob;
  thumb: Blob;
};

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

/**
 * Build three WebP blobs from any image blob/file (e.g. cropped cover).
 * Max dimensions: original 1600px, preview 800px, thumb 320px (long edge).
 */
export async function buildTripCoverWebpVariants(
  source: Blob | File
): Promise<CoverImageVariantBlobs> {
  const img = await loadImage(source);
  const [original, preview, thumb] = await Promise.all([
    renderMaxSide(img, 1600),
    renderMaxSide(img, 800),
    renderMaxSide(img, 320),
  ]);
  return { original, preview, thumb };
}
