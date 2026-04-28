import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TRIP_MEDIA_BUCKET } from "@/lib/trip-media/types";
import { galleryPhotoStoragePathsToRemove } from "@/lib/trip-photos/gallery-delete-paths";

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

/**
 * Deletes one gallery photo: best-effort removal of `trip-media` objects under
 * `{tripId}/photos/{photoId}/`, then deletes the `trip_photos` row.
 * Auth: `Authorization: Bearer <access_token>` (same as POST upload).
 *
 * Storage removal errors are ignored so missing objects don't block DB cleanup (idempotent).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { tripId: string; photoId: string } }
) {
  const tripIdRaw = context.params?.tripId ?? "";
  const photoIdRaw = context.params?.photoId ?? "";
  const tripId = typeof tripIdRaw === "string" ? tripIdRaw.trim() : "";
  const photoId = typeof photoIdRaw === "string" ? photoIdRaw.trim() : "";

  if (!tripId || !UUID_RE.test(tripId) || !photoId || !UUID_RE.test(photoId)) {
    return NextResponse.json({ error: "Invalid trip or photo id." }, { status: 400 });
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

  const { data: row, error: selectError } = await supabase
    .from("trip_photos")
    .select("id, trip_id, media")
    .eq("id", photoId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (selectError) {
    const msg = selectError.message ?? "";
    const status =
      msg.includes("row-level security") ||
      msg.includes("RLS") ||
      msg.includes("permission denied")
        ? 403
        : 500;
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Could not load photo." },
      { status }
    );
  }

  if (!row) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  const paths = galleryPhotoStoragePathsToRemove(tripId, photoId, row.media);

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(TRIP_MEDIA_BUCKET)
      .remove(paths);
    if (storageError && process.env.NODE_ENV === "development") {
      console.warn("[delete trip photo] trip-media remove:", storageError.message);
    }
  }

  const { error: deleteError } = await supabase
    .from("trip_photos")
    .delete()
    .eq("id", photoId)
    .eq("trip_id", tripId);

  if (deleteError) {
    const msg = deleteError.message ?? "";
    const status =
      msg.includes("row-level security") ||
      msg.includes("RLS") ||
      msg.includes("permission denied")
        ? 403
        : 500;
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Could not delete photo." },
      { status }
    );
  }

  return new NextResponse(null, { status: 204 });
}
