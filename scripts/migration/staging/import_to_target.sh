#!/usr/bin/env bash
set -euo pipefail

DIR="${1:-./export}"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

echo "Loading CSVs dynamically based on headers..."

copy_table () {
local table="$1"
local file="$DIR/$table.csv"

if [ ! -f "$file" ]; then
echo "Skipping $table (no file)"
return
fi

echo "Processing $table..."

# Extract header from CSV

HEADER=$(head -n 1 "$file")

"${PSQL[@]}" -c "\copy migration_staging.$table ($HEADER) from '$file' csv header"
}

copy_table trips
copy_table trip_members
copy_table trip_participants
copy_table trip_invitations
copy_table trip_notes
copy_table trip_currencies
copy_table trip_exchange_rates
copy_table trip_place_categories
copy_table trip_places
copy_table trip_budget_categories
copy_table trip_budget_items
copy_table packing_categories
copy_table packing_items
copy_table tasks

echo "Done loading CSVs"
