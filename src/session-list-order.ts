export interface SessionOrderItem {
  key: string;
  directory?: string;
  activity: number;
  pinned: boolean;
}

export interface SessionListPreferences {
  pinned: string[];
  archived: string[];
  orderByDirectory: Record<string, string[]>;
}

export const emptySessionListPreferences = (): SessionListPreferences => ({
  pinned: [],
  archived: [],
  orderByDirectory: {},
});

export function normalizeSessionListPreferences(
  value: Partial<SessionListPreferences> | undefined,
): SessionListPreferences {
  return {
    pinned: Array.isArray(value?.pinned) ? value.pinned.filter((key) => typeof key === "string") : [],
    archived: Array.isArray(value?.archived) ? value.archived.filter((key) => typeof key === "string") : [],
    orderByDirectory: value?.orderByDirectory && typeof value.orderByDirectory === "object"
      ? value.orderByDirectory
      : {},
  };
}

export function orderSessionItems<T extends SessionOrderItem>(
  items: readonly T[],
  preferences: SessionListPreferences,
): T[] {
  const pinnedOrder = new Map(preferences.pinned.map((key, index) => [key, index]));
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) { return left.pinned ? -1 : 1; }
    if (!left.pinned && left.directory !== right.directory) { return right.activity - left.activity; }
    const order = left.pinned
      ? pinnedOrder
      : new Map((preferences.orderByDirectory[left.directory ?? ""] ?? []).map((key, index) => [key, index]));
    const leftIndex = order.get(left.key);
    const rightIndex = order.get(right.key);
    if (leftIndex === undefined && rightIndex === undefined) { return right.activity - left.activity; }
    if (leftIndex === undefined) { return -1; }
    if (rightIndex === undefined) { return 1; }
    return leftIndex - rightIndex;
  });
}

export function moveSessionToFront(
  preferences: SessionListPreferences,
  item: Pick<SessionOrderItem, "key" | "directory" | "pinned">,
): SessionListPreferences {
  if (item.pinned) {
    return { ...preferences, pinned: [item.key, ...preferences.pinned.filter((key) => key !== item.key)] };
  }
  const directory = item.directory ?? "";
  const current = preferences.orderByDirectory[directory] ?? [];
  return {
    ...preferences,
    orderByDirectory: {
      ...preferences.orderByDirectory,
      [directory]: [item.key, ...current.filter((key) => key !== item.key)],
    },
  };
}

export function setSessionPinned(
  preferences: SessionListPreferences,
  item: Pick<SessionOrderItem, "key" | "directory">,
  pinned: boolean,
): SessionListPreferences {
  const withoutPinned = preferences.pinned.filter((key) => key !== item.key);
  const directory = item.directory ?? "";
  const directoryOrder = (preferences.orderByDirectory[directory] ?? []).filter((key) => key !== item.key);
  return {
    ...preferences,
    pinned: pinned ? [item.key, ...withoutPinned] : withoutPinned,
    orderByDirectory: {
      ...preferences.orderByDirectory,
      [directory]: pinned ? directoryOrder : [item.key, ...directoryOrder],
    },
  };
}

export function setSessionGroupOrder(
  preferences: SessionListPreferences,
  keys: readonly string[],
  directory: string | undefined,
  pinned: boolean,
): SessionListPreferences {
  if (pinned) { return { ...preferences, pinned: [...keys] }; }
  return {
    ...preferences,
    orderByDirectory: { ...preferences.orderByDirectory, [directory ?? ""]: [...keys] },
  };
}

export function isSessionArchived(preferences: SessionListPreferences, key: string): boolean {
  return preferences.archived.includes(key);
}

export function setSessionArchived(
  preferences: SessionListPreferences,
  key: string,
  archived: boolean,
): SessionListPreferences {
  const withoutSession = preferences.archived.filter((candidate) => candidate !== key);
  return {
    ...preferences,
    archived: archived ? [key, ...withoutSession] : withoutSession,
  };
}

export function removeSessionListPreference(
  preferences: SessionListPreferences,
  key: string,
): SessionListPreferences {
  return {
    pinned: preferences.pinned.filter((candidate) => candidate !== key),
    archived: preferences.archived.filter((candidate) => candidate !== key),
    orderByDirectory: Object.fromEntries(
      Object.entries(preferences.orderByDirectory).map(([directory, keys]) => [
        directory,
        keys.filter((candidate) => candidate !== key),
      ]),
    ),
  };
}
