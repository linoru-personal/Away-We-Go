/**
 * Centralized editable image presets for crop ratios and display.
 * Single source of truth for trip hero, destination hero, and participant avatar.
 */

export type ImagePresetKey = "trip_hero" | "destination_hero" | "avatar_square";

export type ImagePreset = {
  key: ImagePresetKey;
  /** Aspect ratio (width / height) for crop and display. */
  aspect: number;
  /** Recommended output dimensions [width, height] for cropped asset. */
  outputWidth: number;
  outputHeight: number;
  label: string;
};

/** Trip cover: crop aspect matches TripHero on dashboard (full width × 280px; 1024/280 ≈ 3.66). */
export const TRIP_HERO_PRESET: ImagePreset = {
  key: "trip_hero",
  aspect: 1024 / 280,
  outputWidth: 960,
  outputHeight: Math.round(960 / (1024 / 280)),
  label: "Trip cover",
};

/** Short wide banner for destination (Places & map card). Crop matches display height. */
export const DESTINATION_HERO_PRESET: ImagePreset = {
  key: "destination_hero",
  aspect: 6,
  outputWidth: 960,
  outputHeight: 160,
  label: "Destination cover",
};

/** Participant avatar: square for circles in UI. */
export const AVATAR_SQUARE_PRESET: ImagePreset = {
  key: "avatar_square",
  aspect: 1,
  outputWidth: 256,
  outputHeight: 256,
  label: "Participant photo",
};

export const IMAGE_PRESETS: Record<ImagePresetKey, ImagePreset> = {
  trip_hero: TRIP_HERO_PRESET,
  destination_hero: DESTINATION_HERO_PRESET,
  avatar_square: AVATAR_SQUARE_PRESET,
};

export function getImagePreset(key: ImagePresetKey): ImagePreset {
  return IMAGE_PRESETS[key];
}
