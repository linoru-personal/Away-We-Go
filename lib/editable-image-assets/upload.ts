/**
 * Shared helpers for persisting editable image assets: original + cropped in Storage,
 * crop metadata in editable_image_assets, and legacy path columns kept in sync.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CropMetadata, EditableImageOwnerType } from "@/lib/editable-image-assets";
import type { ImagePresetKey } from "@/lib/image-presets";

const EDITABLE_IMAGES_BUCKET = "editable-images";
const TRIP_COVERS_BUCKET = "trip-covers";
const AVATARS_BUCKET = "avatars";

function getExtension(file: File): string {
  const name = file.name;
  const last = name.split(".").pop()?.toLowerCase();
  if (last && /^[a-z0-9]+$/.test(last)) return last;
  const mime = file.type;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function getPresetKeyForOwnerType(ownerType: EditableImageOwnerType): ImagePresetKey {
  switch (ownerType) {
    case "trip_cover":
      return "trip_hero";
    case "destination_cover":
      return "destination_hero";
    case "participant_avatar":
      return "avatar_square";
    default:
      return "trip_hero";
  }
}

export type StoragePaths = {
  originalPath: string;
  croppedPath: string;
  legacyBucket: string;
  legacyPath: string;
};

/**
 * Generates storage paths for an editable asset.
 * editable-images: {trip_id}/{owner_type}/{asset_id}/original.{ext} and .../cropped.jpg
 * For avatar: {trip_id}/participant_avatar/{participant_id}/{asset_id}/...
 */
export function getStoragePaths(
  ownerType: EditableImageOwnerType,
  tripId: string,
  assetId: string,
  originalExt: string,
  participantId?: string | null
): StoragePaths {
  const base =
    participantId != null && ownerType === "participant_avatar"
      ? `${tripId}/participant_avatar/${participantId}/${assetId}`
      : `${tripId}/${ownerType}/${assetId}`;
  const originalPath = `${base}/original.${originalExt}`;
  const croppedPath = `${base}/cropped.jpg`;

  if (ownerType === "trip_cover") {
    return { originalPath, croppedPath, legacyBucket: TRIP_COVERS_BUCKET, legacyPath: `${tripId}/cover.jpg` };
  }
  if (ownerType === "destination_cover") {
    return { originalPath, croppedPath, legacyBucket: TRIP_COVERS_BUCKET, legacyPath: `${tripId}/destination.jpg` };
  }
  if (ownerType === "participant_avatar" && participantId) {
    return { originalPath, croppedPath, legacyBucket: AVATARS_BUCKET, legacyPath: `${tripId}/${participantId}.jpg` };
  }
  throw new Error("participant_avatar requires participantId");
}

export type SaveEditableImageAssetParams = {
  tripId: string;
  ownerType: EditableImageOwnerType;
  participantId?: string | null;
  originalFile: File;
  croppedBlob: Blob;
  cropMetadata: CropMetadata;
  /** When provided, reuse this asset id (for edit flow overwrite). */
  existingAssetId?: string | null;
};

/**
 * Uploads original + cropped to editable-images, cropped to legacy bucket,
 * upserts editable_image_assets row, and updates legacy column.
 */
export async function saveEditableImageAsset(
  supabase: SupabaseClient,
  params: SaveEditableImageAssetParams
): Promise<{ assetId: string; legacyPath: string }> {
  const {
    tripId,
    ownerType,
    participantId,
    originalFile,
    croppedBlob,
    cropMetadata,
    existingAssetId,
  } = params;

  const assetId = existingAssetId ?? crypto.randomUUID();
  const ext = getExtension(originalFile);
  const paths = getStoragePaths(ownerType, tripId, assetId, ext, participantId);
  const aspectPresetKey = getPresetKeyForOwnerType(ownerType);

  const { error: origErr } = await supabase.storage
    .from(EDITABLE_IMAGES_BUCKET)
    .upload(paths.originalPath, originalFile, { upsert: true, contentType: originalFile.type });
  if (origErr) throw new Error(origErr.message);

  const { error: cropErr } = await supabase.storage
    .from(EDITABLE_IMAGES_BUCKET)
    .upload(paths.croppedPath, croppedBlob, { upsert: true, contentType: "image/jpeg" });
  if (cropErr) throw new Error(cropErr.message);

  const { error: legacyErr } = await supabase.storage
    .from(paths.legacyBucket)
    .upload(paths.legacyPath, croppedBlob, { upsert: true, contentType: "image/jpeg" });
  if (legacyErr) throw new Error(legacyErr.message);

  const row = {
    id: assetId,
    owner_type: ownerType,
    trip_id: tripId,
    participant_id: ownerType === "participant_avatar" ? participantId : null,
    original_path: paths.originalPath,
    cropped_path: paths.croppedPath,
    crop_metadata: cropMetadata as unknown as Record<string, unknown>,
    aspect_preset: aspectPresetKey,
  };

  if (existingAssetId) {
    const { error: updateErr } = await supabase
      .from("editable_image_assets")
      .update({
        original_path: row.original_path,
        cropped_path: row.cropped_path,
        crop_metadata: row.crop_metadata,
        aspect_preset: row.aspect_preset,
      })
      .eq("id", existingAssetId);
    if (updateErr) throw new Error(updateErr.message);
  } else {
    const { error: insertErr } = await supabase.from("editable_image_assets").insert(row);
    if (insertErr) throw new Error(insertErr.message);
  }

  if (ownerType === "trip_cover") {
    const { error: tripErr } = await supabase
      .from("trips")
      .update({ cover_image_path: paths.legacyPath })
      .eq("id", tripId);
    if (tripErr) throw new Error(tripErr.message);
  } else if (ownerType === "destination_cover") {
    const { error: tripErr } = await supabase
      .from("trips")
      .update({ destination_image_url: paths.legacyPath })
      .eq("id", tripId);
    if (tripErr) throw new Error(tripErr.message);
  } else if (ownerType === "participant_avatar" && participantId) {
    const { error: partErr } = await supabase
      .from("trip_participants")
      .update({ avatar_path: paths.legacyPath })
      .eq("id", participantId);
    if (partErr) throw new Error(partErr.message);
  }

  return { assetId, legacyPath: paths.legacyPath };
}

/**
 * Fetch existing editable_image_assets row id for trip + owner (and optional participant).
 */
export async function getExistingEditableAssetId(
  supabase: SupabaseClient,
  tripId: string,
  ownerType: EditableImageOwnerType,
  participantId?: string | null
): Promise<string | null> {
  if (ownerType === "participant_avatar" && participantId) {
    const { data } = await supabase
      .from("editable_image_assets")
      .select("id")
      .eq("participant_id", participantId)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }
  const { data } = await supabase
    .from("editable_image_assets")
    .select("id")
    .eq("trip_id", tripId)
    .eq("owner_type", ownerType)
    .is("participant_id", null)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
