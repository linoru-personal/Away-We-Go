/**
 * The rows a group shows, given the list-wide "Show packed items" switch.
 *
 * An item is shown when it is not packed, when packed items are shown, while
 * it lingers (it was just ticked and stays on screen for a few seconds before
 * fading away), or when it is pinned (its last action failed, so its row and
 * error must stay visible). Input order is kept, so drag indices computed on
 * the result match what is on screen.
 */
export function visibleItems<T extends { id: string; is_packed: boolean }>(
  items: readonly T[],
  showPacked: boolean,
  lingering: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  pinnedId: string | null = null
): T[] {
  return items.filter(
    (item) => !item.is_packed || showPacked || lingering.has(item.id) || item.id === pinnedId
  );
}
