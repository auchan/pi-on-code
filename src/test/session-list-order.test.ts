import * as assert from "node:assert";
import {
  emptySessionListPreferences,
  moveSessionToFront,
  orderSessionItems,
  setSessionGroupOrder,
  setSessionPinned,
  type SessionListPreferences,
  type SessionOrderItem,
} from "../session-list-order.js";

const item = (
  key: string,
  activity: number,
  directory = "/workspace/a",
  pinned = false,
): SessionOrderItem => ({ key, activity, directory, pinned });

suite("Session list ordering", () => {
  test("defaults to newest activity first", () => {
    const ordered = orderSessionItems(
      [item("older", 10), item("newer", 20)],
      emptySessionListPreferences(),
    );
    assert.deepStrictEqual(ordered.map((session) => session.key), ["newer", "older"]);
  });

  test("keeps pinned sessions above workspace groups in persisted order", () => {
    const preferences = {
      pinned: ["pinned-b", "pinned-a"],
      orderByDirectory: {},
    };
    const ordered = orderSessionItems(
      [item("regular", 30), item("pinned-a", 10, "/workspace/a", true), item("pinned-b", 5, "/workspace/b", true)],
      preferences,
    );
    assert.deepStrictEqual(ordered.map((session) => session.key), ["pinned-b", "pinned-a", "regular"]);
  });

  test("persists drag order independently for each workspace", () => {
    let preferences = emptySessionListPreferences();
    preferences = setSessionGroupOrder(preferences, ["a-2", "a-1"], "/workspace/a", false);
    preferences = setSessionGroupOrder(preferences, ["b-1", "b-2"], "/workspace/b", false);
    assert.deepStrictEqual(preferences.orderByDirectory, {
      "/workspace/a": ["a-2", "a-1"],
      "/workspace/b": ["b-1", "b-2"],
    });
  });

  test("moves newly active sessions to the front of their current group", () => {
    let preferences: SessionListPreferences = {
      pinned: ["pinned-a", "pinned-b"],
      orderByDirectory: { "/workspace/a": ["a-1", "a-2"] },
    };
    preferences = moveSessionToFront(preferences, item("a-2", 0));
    preferences = moveSessionToFront(preferences, item("pinned-b", 0, "/workspace/b", true));
    assert.deepStrictEqual(preferences.orderByDirectory["/workspace/a"], ["a-2", "a-1"]);
    assert.deepStrictEqual(preferences.pinned, ["pinned-b", "pinned-a"]);
  });

  test("moves sessions between pinned and workspace ordering", () => {
    let preferences: SessionListPreferences = {
      pinned: [],
      orderByDirectory: { "/workspace/a": ["one", "two"] },
    };
    preferences = setSessionPinned(preferences, item("two", 0), true);
    assert.deepStrictEqual(preferences.pinned, ["two"]);
    assert.deepStrictEqual(preferences.orderByDirectory["/workspace/a"], ["one"]);

    preferences = setSessionPinned(preferences, item("two", 0), false);
    assert.deepStrictEqual(preferences.pinned, []);
    assert.deepStrictEqual(preferences.orderByDirectory["/workspace/a"], ["two", "one"]);
  });
});
