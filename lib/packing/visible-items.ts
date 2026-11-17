/**
 * The rows a group shows, given the list-wide "Show packed items" switch.
 *
 * An item is shown when it is not packed, when packed items are shown, or
 * while it lingers (it was just ticked and stays on screen for a few seconds
 * before fading away). Input order is kept, so drag indices computed on the
 * result match what is on screen.
 */
export function visibleItems<T extends { id: string; is_packed: boolean }>(
  items: readonly T[],
  showPacked: boolean,
  lingering: ReadonlySet<string>
): T[] {
  return items.filter((item) => !item.is_packed || showPacked || lingering.has(item.id));
}
