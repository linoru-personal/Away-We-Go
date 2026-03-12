/**
 * Shared crop utility: given image URL, pixel crop area, and zoom,
 * returns cropped blob and full CropMetadata (including source dimensions).
 */

import type { Area } from "react-easy-crop";
import type { CropMetadata } from "@/lib/editable-image-assets";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.src = url;
  });
}

export type CropResult = {
  blob: Blob;
  cropMetadata: CropMetadata;
};

export async function getCroppedImageWithMetadata(
  imageSrc: string,
  pixelCrop: Area,
  zoom: number
): Promise<CropResult | null> {
  const image = await createImage(imageSrc);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
  });
  if (!blob) return null;
  const cropMetadata: CropMetadata = {
    x: Math.round(pixelCrop.x),
    y: Math.round(pixelCrop.y),
    width: Math.round(pixelCrop.width),
    height: Math.round(pixelCrop.height),
    zoom,
    sourceWidth,
    sourceHeight,
  };
  return { blob, cropMetadata };
}
