"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CropMetadata } from "@/lib/editable-image-assets";
import { DESTINATION_HERO_PRESET } from "@/lib/image-presets";
import { getCroppedImageWithMetadata } from "@/lib/crop-utils";

export interface DestinationImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  /** When provided (re-crop), initializes crop and zoom from stored metadata. */
  initialCropMetadata?: CropMetadata | null;
  /** Called with cropped blob and metadata; parent decides when to persist. */
  onCropComplete: (blob: Blob, cropMetadata: CropMetadata) => void;
}

function cropFromMetadata(m: CropMetadata): { x: number; y: number; width: number; height: number } {
  const { sourceWidth, sourceHeight } = m;
  return {
    x: (m.x / sourceWidth) * 100,
    y: (m.y / sourceHeight) * 100,
    width: (m.width / sourceWidth) * 100,
    height: (m.height / sourceHeight) * 100,
  };
}

export function DestinationImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  initialCropMetadata,
  onCropComplete,
}: DestinationImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    if (open && initialCropMetadata) {
      const pct = cropFromMetadata(initialCropMetadata);
      setCrop({ x: pct.x, y: pct.y });
      setZoom(initialCropMetadata.zoom);
      setCroppedAreaPixels({
        x: initialCropMetadata.x,
        y: initialCropMetadata.y,
        width: initialCropMetadata.width,
        height: initialCropMetadata.height,
      });
    }
  }, [open, initialCropMetadata]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropCompleteCallback = useCallback((_crop: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setError(null);
    setProcessing(true);
    try {
      const result = await getCroppedImageWithMetadata(imageSrc, croppedAreaPixels, zoom);
      if (!result) {
        setError("Could not crop image.");
        setProcessing(false);
        return;
      }
      onCropComplete(result.blob, result.cropMetadata);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex max-h-[90vh] min-h-0 w-full flex-col">
          <div className="shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
                Crop destination cover image
              </DialogTitle>
              <p className="mt-1 text-[15px] leading-relaxed text-[#6b6b6b]">
                Adjust the crop (wide format for {DESTINATION_HERO_PRESET.label}). Then continue.
              </p>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="relative mt-4 h-[200px] w-full overflow-hidden rounded-xl bg-[#1a1a1a]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={DESTINATION_HERO_PRESET.aspect}
                onCropChange={setCrop}
                onCropComplete={onCropCompleteCallback}
                onZoomChange={setZoom}
                style={{ containerStyle: { backgroundColor: "#1a1a1a" } }}
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-[#1f1f1f]">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-1 w-full accent-[#d97b5e]"
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3 pb-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={processing}
                className="flex-1 rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2.5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={processing}
                className="flex-1 rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-60"
              >
                {processing ? "Processing…" : "Done"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
