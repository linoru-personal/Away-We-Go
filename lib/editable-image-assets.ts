/**
 * Types for the editable_image_assets table (Supabase).
 * Used for trip cover, destination cover, and participant avatar with original + crop metadata + cropped derivative.
 */

export type EditableImageOwnerType =
  | "trip_cover"
  | "destination_cover"
  | "participant_avatar";

export type EditableImageAssetRow = {
  id: string;
  owner_type: EditableImageOwnerType;
  trip_id: string;
  participant_id: string | null;
  original_path: string;
  cropped_path: string;
  crop_metadata: CropMetadata | null;
  aspect_preset: string | null;
  created_at: string;
  updated_at: string;
};

/** Crop rect + zoom + source dimensions for cross-device re-crop (crop_metadata jsonb). */
export type CropMetadata = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  sourceWidth: number;
  sourceHeight: number;
};
