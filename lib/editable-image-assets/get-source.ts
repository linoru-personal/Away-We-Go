/**
 * Resolves the image source for editing crop: original from editable_image_assets
 * or legacy path when no editable asset exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CropMetadata, EditableImageOwnerType } from "@/lib/editable-image-assets";
import type { ImagePresetKey } from "@/lib/image-presets";
import { getPresetKeyForOwnerType } from "./upload";

const EDITABLE_IMAGES_BUCKET = "editable-images";
const TRIP_COVERS_BUCKET = "trip-covers";
const AVATARS_BUCKET = "avatars";

function getLegacyBucket(ownerType: EditableImageOwnerType): string {
  if (ownerType === "participant_avatar") return AVATARS_BUCKET;
  return TRIP_COVERS_BUCKET;
}

export type EditableImageSource = {
  /** Signed URL to load in crop dialog (original or legacy image). */
  originalPath: string;
  /** Storage path of current cropped asset (for reference). */
  croppedPath: string;
  cropMetadata: CropMetadata | null;
  /** Preset key for aspect ratio (trip_hero, destination_hero, avatar_square). */
  aspectPreset: ImagePresetKey;
  /** Alias for aspectPreset (backward compatibility). */
  preset: ImagePresetKey;
  /** When set, re-crop updates this asset only (cropped + metadata). */
  existingAssetId: string | null;
  /** True when editable_image_assets row exists; false when legacy-only. */
  isAssetBacked: boolean;
};

type GetSourceParams = {
  tripId: string;
  ownerType: EditableImageOwnerType;
  participantId?: string | null;
  /** Current legacy path (e.g. trip.cover_image_path) when no editable row. */
  legacyPath: string | null;
};

const SIGNED_URL_EXPIRY = 3600;

/**
 * Loads the editable image source for crop dialog.
 * Priority: editable_image_assets.original_path, then legacy path.
 * Returns signed URL as originalPath, plus cropMetadata and preset.
 */
export async function getEditableImageSource(
  supabase: SupabaseClient,
  params: GetSourceParams
): Promise<EditableImageSource | null> {
  const { tripId, ownerType, participantId, legacyPath } = params;
  const preset = getPresetKeyForOwnerType(ownerType);

  if (ownerType === "participant_avatar" && participantId) {
    const { data: row } = await supabase
      .from("editable_image_assets")
      .select("id, original_path, cropped_path, crop_metadata")
      .eq("participant_id", participantId)
      .maybeSingle();

    if (row) {
      const r = row as { id: string; original_path: string; cropped_path: string; crop_metadata: CropMetadata | null };
      const { data: signed } = await supabase.storage
        .from(EDITABLE_IMAGES_BUCKET)
        .createSignedUrl(r.original_path, SIGNED_URL_EXPIRY);
      if (!signed?.signedUrl) return null;
      return {
        originalPath: signed.signedUrl,
        croppedPath: r.cropped_path,
        cropMetadata: r.crop_metadata,
        aspectPreset: preset,
        preset,
        existingAssetId: r.id,
        isAssetBacked: true,
      };
    }
  } else {
    const { data: row } = await supabase
      .from("editable_image_assets")
      .select("id, original_path, cropped_path, crop_metadata")
      .eq("trip_id", tripId)
      .eq("owner_type", ownerType)
      .is("participant_id", null)
      .maybeSingle();

    if (row) {
      const r = row as { id: string; original_path: string; cropped_path: string; crop_metadata: CropMetadata | null };
      const { data: signed } = await supabase.storage
        .from(EDITABLE_IMAGES_BUCKET)
        .createSignedUrl(r.original_path, SIGNED_URL_EXPIRY);
      if (!signed?.signedUrl) return null;
      return {
        originalPath: signed.signedUrl,
        croppedPath: r.cropped_path,
        cropMetadata: r.crop_metadata,
        aspectPreset: preset,
        preset,
        existingAssetId: r.id,
        isAssetBacked: true,
      };
    }
  }

  if (!legacyPath) return null;
  const bucket = getLegacyBucket(ownerType);
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(legacyPath, SIGNED_URL_EXPIRY);
  if (!signed?.signedUrl) return null;
  return {
    originalPath: signed.signedUrl,
    croppedPath: legacyPath,
    cropMetadata: null,
    aspectPreset: preset,
    preset,
    existingAssetId: null,
    isAssetBacked: false,
  };
}
