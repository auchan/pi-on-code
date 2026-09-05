# Changelog

## 0.2.12

- Collapse finished Thinking and execution steps into single-fold rows with star fold icons, merging consecutive tool calls across empty assistant stubs, and add a per-turn Copy control that copies the full assistant reply without tool calls or thinking.
- Stop auto-scroll from fighting the mouse wheel: an upward scroll latches the view until you scroll back to the live edge, and the transcript settles onto the true bottom after async rendering.
- Rework Thinking blocks so they stay visible while streaming, show a live tail without an internal scrollbar, and become a scrollable reader only when expanded for reading.
- Highlight user messages as distinct full-width cards with a theme-safe tinted background.
- Cap session tab title length to keep tabs readable.

## 0.2.11

- Rename Sessions inline from their action or context menu, preserving the full current title while editing.
- Pin Sessions above workspace groups and drag them into a persistent per-workspace order that still prioritizes newly active Sessions.
- Archive Sessions without moving their JSONL files, browse them in a dedicated directory-grouped view with exact timestamps, and restore or permanently delete them with guarded actions and responsive archive animations.
- Reduce the conversation minimap's reserved gutter so the transcript uses more of the available width.

## 0.2.10

- Render local Markdown images from `file:` URLs, absolute paths, and conversation/workspace-relative paths, including Windows backslash paths and files outside the workspace, without resetting the Webview.
- Show generic tool arguments in tool headers and add a hover-revealed `Copy` control for complete tool calls; Bash cards copy the command and keep the control beside the exit status.
- Automatically acknowledge linked Issue reporters in CI-generated GitHub release notes.

## 0.2.9

- Bash 工具改由 Pi SDK 的默认会话构造创建，`settings.json` 中的 `shellPath` 设置现在生效，可指定自定义 shell（如安装在非默认位置的 Git Bash）。
- 会话列表会标记存在未查看结果的会话。
- 新增简体中文 README（`README.zh-CN.md`）及 Issue 驱动的开发说明：在 GitHub Issues 中提交需求或 Bug，pi-claw agent 会自动完成开发或修复。

## 0.2.8

- Consolidated the 16 VS Code bridge tools into a single `vscode_workspace_tool` with a CLI-style `help` listing, roughly halving the per-request tool-definition token cost.
- Tool cards now show the resolved capability (e.g. `vscode_open_file`) and clickable file path links, matching the read/write/edit cards.
- Removed the always-instructed diagnostics pre-check from the system prompt.
- Kept the conversation minimap highlight tracking the current turn while streaming and on live messages.

## 0.2.7

- Reworked the conversation minimap into a fixed-pitch scrollable rail that uses the full chat viewport, fades only toward hidden turns, aligns with equal padding above the chat and the composer, and supports wheel scrolling while hovered.
- Added a horizontally centered scroll-to-latest button that appears above the composer whenever the conversation leaves the live edge and returns to follow streaming output when clicked.
- Batch-loaded the exact older-history range needed for an unloaded minimap jump into a single atomic page, eliminating mid-load flicker before revealing the target.
- Introduced a scroll-owner state machine so minimap jumps, reveal jumps, and manual scrolling are never interrupted by streamed DOM updates, and are released on reaching the bottom or on the next user interaction.
- Fixed the minimap's current-turn highlight so it keeps tracking the visible conversation while scrolling, even when a live message was echoed before its history entry (and matching entry id) existed.

## 0.2.6

- Restored the top-right new-session action for single-folder workspaces while retaining refresh and per-folder creation controls for multi-folder workspaces.

## 0.2.5

- Added a complete conversation minimap with full-session previews, current-turn highlighting, distance-based hover expansion, and on-demand loading of older turns.
- Grouped sessions by workspace folder with persistent collapsible state, folder status icons, and hover-revealed actions.
- Improved edit tool previews with precise line-level diffs.

## 0.2.4

- Added reusable draft sessions that initialize on the first prompt and preserve the new-session introduction.
- Added cross-session references, session action menus, and reliable session-list refresh after automatic naming.
- Added conversation copy controls for user, assistant, and tool output, including displayed diffs and Bash commands.
- Improved tool cards with complete wrapped titles, accurate change counts, compact collapse behavior, and precise file-link hit areas.
- Added full VS Code integration testing to CI and hardened the Issue-driven development pipeline.

## 0.2.3

- Added substring search across Slash command names and descriptions, including `skill:` names containing `:` and `-` separators.
- Ranked Slash search results by exact, prefix, command-segment, command-substring, and description relevance while preserving stable ordering for ties.

## 0.2.2

- Added per-session Capabilities management for Skills and Extensions, including compact source links, persisted toggles, and session-aligned snapshots.
- Added Skills, Prompt Templates, and Extension Commands to Slash autocomplete with source and scope badges.
- Added a focused Custom TUI bridge for interactive extension panels such as `pi-mcp-adapter`, with keyboard input, mouse-wheel navigation, responsive overlays, and safe ANSI color rendering.
- Fixed MCP connection status updates, Custom TUI width stability, and capability state synchronization across Sessions.

## 0.2.1

- Finalized the Marketplace identity as `auchan.pion-code` with the `Pi / Code` display name and a transparent icon.
- Fixed initial history replay and restoration of previously open session tabs.

## 0.2.0

- Added persistent multi-session navigation, startup restoration of previously open session tabs, lazy history loading, and reliable conversation scroll following.
- Added active-editor context, workspace file and folder attachments, file mentions, and streaming image follow-ups.
- Added Pi Package and Session extension management inside the sidebar and conversation.
- Added inline extension questions, autocomplete keyboard navigation, and conversation jump controls.
- Added compact-by-default long tool output with explicit expansion controls.
- Added secure Anthropic and OpenAI API key storage through VS Code SecretStorage.
- Honored skills, context-file, prompt-template, installation-prompt, and system-prompt settings.
- Restricted the extension to trusted, non-virtual workspaces and removed conflicting global shortcuts.
- Changed automatic chat-tab opening to opt-in and prepared Marketplace publisher metadata.

## 0.1.1

- Replaced the native sessions tree with a Pi Web-styled session sidebar.
- Added compact session age, streaming state, active-row highlighting, and direct session switching.

## 0.1.0

- Created the Pi on Code VS Code extension.
- Added the Pi Web terminal-style visual system.
- Rebranded commands, settings, Activity Bar views, and session metadata.
- Preserved Pi SDK sessions, streaming, tools, packages, and editor bridges.
