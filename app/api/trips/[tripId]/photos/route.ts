import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { TRIP_MEDIA_BUCKET } from "@/lib/trip-media/types";
import {
  createTripPhotosMedia,
  galleryDisplayPath,
  galleryThumbPath,
} from "@/lib/trip-photos/media";

/** Long-edge caps for generated WebP variants. */
const THUMB_LONG_EDGE = 300;
const DISPLAY_LONG_EDGE = 1600;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

function createUserSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function removeTripMediaPaths(
  supabase: ReturnType<typeof createUserSupabase>,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(TRIP_MEDIA_BUCKET).remove(paths);
}

/**
 * POST multipart/form-data with field `file` — uploads thumb + display WebP to `trip-media`,
 * then inserts `trip_photos` with `media` only (no `image_path`).
 *
 * Auth: `Authorization: Bearer <access_token>` (same pattern as `app/api/trip-invitations/route.ts`).
 */
export async function POST(
  request: NextRequest,
  context: { params: { tripId: string } }
) {
  const tripIdRaw = context.params?.tripId ?? "";
  const tripId = typeof tripIdRaw === "string" ? tripIdRaw.trim() : "";

  if (!tripId || !UUID_RE.test(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required. Send Authorization: Bearer <access_token>." },
      { status: 401 }
    );
  }

  let supabase: ReturnType<typeof createUserSupabase>;
  try {
    supabase = createUserSupabase(token);
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: 'Expected multipart field "file" with one image.' },
      { status: 400 }
    );
  }

  if (!fileEntry.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }

  if (fileEntry.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).` },
      { status: 400 }
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const photoId = crypto.randomUUID();
  const thumbPath = galleryThumbPath(tripId, photoId);
  const displayPath = galleryDisplayPath(tripId, photoId);

  let thumbBuf: Buffer;
  let displayBuf: Buffer;
  try {
    const pipelineBase = sharp(inputBuffer).rotate();

    thumbBuf = await pipelineBase
      .clone()
      .resize(THUMB_LONG_EDGE, THUMB_LONG_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    displayBuf = await sharp(inputBuffer)
      .rotate()
      .resize(DISPLAY_LONG_EDGE, DISPLAY_LONG_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Could not process image. Try a different format." },
      { status: 400 }
    );
  }

  const thumbMeta = await sharp(thumbBuf).metadata();
  const displayMeta = await sharp(displayBuf).metadata();

  const tw = thumbMeta.width;
  const th = thumbMeta.height;
  const dw = displayMeta.width;
  const dh = displayMeta.height;

  if (
    tw == null ||
    th == null ||
    dw == null ||
    dh == null ||
    tw < 1 ||
    th < 1 ||
    dw < 1 ||
    dh < 1
  ) {
    return NextResponse.json({ error: "Could not read image dimensions." }, { status: 400 });
  }

  const media = createTripPhotosMedia({
    tripId,
    photoId,
    thumb: { width: tw, height: th },
    display: { width: dw, height: dh },
  });

  const uploadedPaths: string[] = [];

  try {
    const { error: upThumbError } = await supabase.storage
      .from(TRIP_MEDIA_BUCKET)
      .upload(thumbPath, thumbBuf, {
        contentType: "image/webp",
        upsert: false,
      });
    if (upThumbError) {
      throw new Error(upThumbError.message);
    }
    uploadedPaths.push(thumbPath);

    const { error: upDisplayError } = await supabase.storage
      .from(TRIP_MEDIA_BUCKET)
      .upload(displayPath, displayBuf, {
        contentType: "image/webp",
        upsert: false,
      });
    if (upDisplayError) {
      throw new Error(upDisplayError.message);
    }
    uploadedPaths.push(displayPath);

    const { data: row, error: insertError } = await supabase
      .from("trip_photos")
      .insert({
        id: photoId,
        trip_id: tripId,
        added_by_user_id: user.id,
        media,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    await removeTripMediaPaths(supabase, uploadedPaths);
    const message =
      err instanceof Error ? err.message : "Upload failed.";
    const status =
      message.includes("row-level security") ||
      message.includes("RLS") ||
      message.includes("permission denied")
        ? 403
        : 500;
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Upload failed." },
      { status }
    );
  }
}
