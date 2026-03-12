"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import TripHero from "@/components/trip/trip-hero";
import { formatTripDateRange } from "@/lib/format-trip-dates";
import { AddPlaceDialog, type PlaceCategory } from "@/components/places/add-place-dialog";
import { PlaceCard, type TripPlace } from "@/components/places/place-card";
import { ManagePlaceCategoriesDialog } from "@/components/places/manage-place-categories-dialog";
import { CategoryIcon, getIconKey, PLACES_DEFAULT_ICON } from "@/components/ui/category-icons";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  created_at: string | null;
};


export default function TripPlacesPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const { canEditContent } = useTripRole(trip, user?.id ?? undefined);
  const [tripLoading, setTripLoading] = useState(true);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [participantAvatarUrls, setParticipantAvatarUrls] = useState<(string | null)[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [categories, setCategories] = useState<PlaceCategory[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<TripPlace | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  useEffect(() => {
    if (!trip?.cover_image_path) {
      setCoverImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("trip-covers")
      .createSignedUrl(trip.cover_image_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) setCoverImageUrl(data.signedUrl);
        else setCoverImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.cover_image_path]);

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
      return;
    }
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!user || !id) {
      setTripLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setTrip(data as Trip);
        setTripLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (!id) {
      setParticipantAvatarUrls([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("trip_participants")
      .select("avatar_path, sort_order")
      .eq("trip_id", id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setParticipantAvatarUrls([]);
          return;
        }
        const rows = (data ?? []) as { avatar_path: string | null }[];
        Promise.all(
          rows.map(async (r) => {
            if (!r.avatar_path) return null;
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(r.avatar_path, 3600);
            return signed?.signedUrl ?? null;
          })
        ).then((urls) => {
          if (!cancelled) setParticipantAvatarUrls(urls);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fetchCategories = () => {
    if (!id) return;
    supabase
      .from("trip_place_categories")
      .select("id, name, icon")
      .eq("trip_id", id)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setCategories([]);
        } else {
          setCategories((data ?? []) as PlaceCategory[]);
        }
      });
  };

  const fetchPlaces = () => {
    if (!id) return;
    setPlacesLoading(true);
    supabase
      .from("trip_places")
      .select("id, trip_id, title, google_maps_url, notes, category_id, created_at")
      .eq("trip_id", id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setPlaces([]);
        } else {
          setPlaces((data ?? []) as TripPlace[]);
        }
        setPlacesLoading(false);
      });
  };

  useEffect(() => {
    if (!id) {
      setPlacesLoading(false);
      return;
    }
    fetchCategories();
    fetchPlaces();
  }, [id]);

  const handleDelete = async (placeId: string) => {
    setDeletingId(placeId);
    const { error } = await supabase
      .from("trip_places")
      .delete()
      .eq("id", placeId);
    setDeletingId(null);
    if (!error) {
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    }
  };

  if (sessionLoading) {
    return (
      <p className="flex min-h-screen items-center justify-center p-6 text-[#6B7280]">
        Loading...
      </p>
    );
  }

  if (!user) return null;

  if (!id) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F4]">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        {tripLoading ? (
          <p className="text-[#6B7280]">Loading…</p>
        ) : trip ? (
          <>
            <TripHero
              title={trip.title}
              dates={formatTripDateRange(trip.start_date, trip.end_date)}
              imageUrl={coverImageUrl ?? trip.cover_image_url ?? undefined}
              onBack={() => router.push(`/dashboard/trip/${id}`)}
              participants={participantAvatarUrls.map((avatarUrl) => ({ avatarUrl }))}
            />
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-lg font-semibold text-[#4A4A4A]">Places</h1>
                {canEditContent && (
                <button
                  type="button"
                  className="rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2"
                  onClick={() => {
                    setEditingPlace(null);
                    setPlaceDialogOpen(true);
                  }}
                >
                  Add place
                </button>
                )}
              </div>
              {canEditContent && (
              <button
                type="button"
                className="mt-1 text-sm font-medium text-[#E07A5F] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
                onClick={() => setManageCategoriesOpen(true)}
              >
                Manage Categories
              </button>
              )}
            </div>
            {placesLoading ? (
              <p className="mt-4 text-sm text-[#8a8a8a]">Loading places…</p>
            ) : places.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#ebe5df] bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <p className="text-sm text-[#8a8a8a]">
                  No places yet. Add your first place from Google Maps.
                </p>
                {canEditContent && (
                <button
                  type="button"
                  className="mt-4 text-sm font-medium text-[#E07A5F] transition hover:underline"
                  onClick={() => {
                    setEditingPlace(null);
                    setPlaceDialogOpen(true);
                  }}
                >
                  Add place
                </button>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-8">
                {(() => {
                  const uncategorized = places.filter((p) => !p.category_id);
                  const byCategory = categories.map((cat) => ({
                    category: cat,
                    places: places.filter((p) => p.category_id === cat.id),
                  })).filter((g) => g.places.length > 0);
                  const sections: { label: string; icon: string | null; places: TripPlace[] }[] = [];
                  if (uncategorized.length > 0) {
                    sections.push({ label: "General", icon: null, places: uncategorized });
                  }
                  byCategory.forEach((g) => {
                    sections.push({ label: g.category.name, icon: g.category.icon, places: g.places });
                  });
                  return sections.map((section) => (
                    <section key={section.label}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="shrink-0 text-[#4A4A4A]">
                          <CategoryIcon
                            iconKey={getIconKey(section.icon, PLACES_DEFAULT_ICON)}
                            size={20}
                          />
                        </span>
                        <h2 className="text-base font-semibold text-[#4A4A4A]">{section.label}</h2>
                      </div>
                      <ul className="space-y-4" role="list">
                        {section.places.map((place) => {
                          const categoryDisplay = place.category_id
                            ? (() => {
                                const cat = categories.find((c) => c.id === place.category_id);
                                return cat ? { name: cat.name, icon: cat.icon } : null;
                              })()
                            : null;
                          return (
                            <li key={place.id}>
                              <PlaceCard
                                place={place}
                                category={categoryDisplay}
                                canEditContent={canEditContent}
                                onEdit={(p) => {
                                  setEditingPlace(p);
                                  setPlaceDialogOpen(true);
                                }}
                                onDelete={handleDelete}
                                deletingId={deletingId}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ));
                })()}
              </div>
            )}
            <ManagePlaceCategoriesDialog
              open={manageCategoriesOpen}
              onOpenChange={setManageCategoriesOpen}
              tripId={id}
              categories={categories}
              onSuccess={() => {
                fetchCategories();
                fetchPlaces();
              }}
            />
            <AddPlaceDialog
              mode={editingPlace ? "edit" : "create"}
              tripId={id}
              userId={user.id}
              open={placeDialogOpen}
              onOpenChange={(open) => {
                setPlaceDialogOpen(open);
                if (!open) setEditingPlace(null);
              }}
              onSuccess={() => {
                fetchPlaces();
                fetchCategories();
              }}
              onCategoryCreated={fetchCategories}
              categories={categories}
              initialValues={
                editingPlace
                  ? {
                      id: editingPlace.id,
                      title: editingPlace.title,
                      google_maps_url: editingPlace.google_maps_url,
                      notes: editingPlace.notes,
                      category_id: editingPlace.category_id,
                    }
                  : null
              }
            />
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[#6B7280]">Trip not found.</p>
            <button
              type="button"
              className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950]"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
