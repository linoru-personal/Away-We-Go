import munichPlacesData from "@/src/lib/mock-data/munich-places.json";

export type SearchPlacesParams = {
  city?: string;
  category?: string;
  tags?: string[];
  childAge?: number;
};

type MunichPlace = {
  id: string;
  name: string;
  city: string;
  category: string;
  tags: string[];
  ageRange: [number, number];
  description: string;
};

const places = munichPlacesData as MunichPlace[];
const MAX_RESULTS = 5;

/**
 * Trip destinations are often "City, Region" or "City, Country" (e.g. "Bad Feilnbach, Munich"),
 * while place data may only have "Munich". Exact equality is too strict, so we use normalized
 * partial matching: place matches if either string contains the other.
 */
function matchesCity(place: MunichPlace, destination: string): boolean {
  const a = normalizeCityString(place.city);
  const b = normalizeCityString(destination);
  if (a === "" || b === "") return a === b;
  return a.includes(b) || b.includes(a);
}

function normalizeCityString(s: string): string {
  return s.trim().toLowerCase();
}

function matchesCategory(place: MunichPlace, category: string): boolean {
  const c = category.toLowerCase();
  const p = place.category.toLowerCase();
  if (c === "park") {
    return p === "park" || p === "playground";
  }
  return p === c;
}

function matchesTags(place: MunichPlace, requiredTags: string[]): boolean {
  const placeTagsLower = place.tags.map((t) => t.toLowerCase());
  return requiredTags.every((tag) =>
    placeTagsLower.includes(tag.toLowerCase())
  );
}

function matchesAgeRange(place: MunichPlace, age: number): boolean {
  const [min, max] = place.ageRange;
  return age >= min && age <= max;
}

/**
 * Search Munich family-friendly places from local mock data.
 * Returns up to 5 results matching the given filters.
 */
export async function searchPlaces(
  params: SearchPlacesParams
): Promise<MunichPlace[]> {
  let results = [...places];

  // [agent debug] remove when done
  console.log("[agent debug] searchPlaces: before filtering, places count =", results.length);

  if (params.city != null && params.city !== "") {
    results = results.filter((p) => matchesCity(p, params.city!));
    console.log("[agent debug] searchPlaces: after city filter, count =", results.length);
  }

  if (params.category != null && params.category !== "") {
    results = results.filter((p) => matchesCategory(p, params.category!));
    console.log("[agent debug] searchPlaces: after category filter, count =", results.length);
  }

  if (params.tags != null && params.tags.length > 0) {
    results = results.filter((p) => matchesTags(p, params.tags!));
    console.log("[agent debug] searchPlaces: after tags filter, count =", results.length);
  }

  if (params.childAge != null) {
    results = results.filter((p) => matchesAgeRange(p, params.childAge!));
    console.log("[agent debug] searchPlaces: after childAge filter, count =", results.length);
  }

  return results.slice(0, MAX_RESULTS);
}
