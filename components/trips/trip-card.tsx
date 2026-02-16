import { Card, CardContent } from "@/components/ui/card";

export interface TripCardProps {
  title: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  onClick?: () => void;
}

export function TripCard({
  title,
  startDate,
  endDate,
  coverImageUrl,
  onClick,
}: TripCardProps) {
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
      </CardContent>
    </Card>
  );
}
