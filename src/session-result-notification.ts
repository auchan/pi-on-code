export function isSessionResultUnread(
  panelActive: boolean,
  windowFocused: boolean,
): boolean {
  return !panelActive || !windowFocused;
}
