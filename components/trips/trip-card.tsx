import { Card, CardContent } from "@/components/ui/card";

export interface TripCardProps {
  title: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  onClick?: () => void;
  /** Optional participant avatar URLs (signed). Shown as overlapping circles. */
  participantAvatarUrls?: (string | null)[];
}

export function TripCard({
  title,
  startDate,
  endDate,
  coverImageUrl,
  onClick,
  participantAvatarUrls,
}: TripCardProps) {
  const avatars = participantAvatarUrls ?? [];
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt=""
          className="h-44 w-full rounded-t-3xl object-cover"
        />
      ) : (
        <div className="h-44 w-full rounded-t-3xl bg-neutral-200" />
      )}
      <CardContent>
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-neutral-500">
          {startDate} → {endDate}
        </div>
        {avatars.length > 0 && (
          <div className="mt-2 flex -space-x-2">
            {avatars.slice(0, 5).map((url, i) => (
              <div
                key={i}
                className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-neutral-300"
              >
                {url ? (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-medium text-neutral-500">?</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
