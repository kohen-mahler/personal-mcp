/**
 * Ritual tools — morning ritual integration between personal-mcp and Pulse.
 *
 * Data flow:
 *   morning_context     → reads Pulse API (habits + goals) + vault (Jotpad) + wiki (goals library)
 *   ritual_add_goal     → writes via Pulse API POST /api/ritual/goals/add
 *   ritual_dismiss_goal → writes via Pulse API POST /api/ritual/goals/dismiss
 *   ritual_toggle_habit → writes via Pulse API POST /api/ritual/habits/:id/toggle
 *
 * Pulse API base: http://localhost:31337 (override via PULSE_URL env var)
 * Pulse source:   ~/.claude/PAI/Pulse/modules/ritual.ts
 * Goals storage:  ~/wiki/ritual/goals/YYYY-MM-DD.json
 * Habits storage: ~/wiki/ritual/habits/YYYY-MM-DD.json
 *
 * Rollover: Pulse auto-rolls undone goals from yesterday when today's file is first created.
 * The morning_context call triggers this — rolled goals appear in goals[] with rolledFrom set.
 *
 * Habit IDs (fixed in Pulse): reading | bible | workout | text-5 | water | deep-work | sunlight
 *
 * PAI skill: ~/.claude/skills/morning/SKILL.md orchestrates the ritual conversation.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { getMorningContext, addGoal, toggleHabit, dismissGoal } from "./morning";
import { toToolText, toToolError } from "../vault/format";

export function registerRitualTools(server: McpServer, vault: VaultDefinition, wiki: VaultDefinition) {

  // ── morning_context ─────────────────────────────────────────────────────────

  server.registerTool(
    "morning_context",
    {
      description:
        "Load full morning ritual context in one call. Returns: " +
        "(1) habits — 7 fixed daily habits with current done/undone state; " +
        "(2) goals — today's goals, including undone goals auto-rolled from yesterday (rolledFrom field set); " +
        "(3) jotpad — active priorities from vault '00 Dashboard/Jotpad.md'; " +
        "(4) goalsLibrary — selectable options from wiki 'ritual/daily-goals.md'. " +
        "Calling this triggers Pulse to create today's goals file from yesterday's rollover if it doesn't exist yet. " +
        "habits/goals are null when Pulse is unreachable (localhost:31337, override via PULSE_URL). " +
        "After reviewing context: use ritual_add_goal to add new goals, " +
        "ritual_dismiss_goal to remove unwanted rolled-over goals, " +
        "ritual_toggle_habit to mark habits already done.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await getMorningContext(vault.rootPath, wiki.rootPath);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.data, null, 2));
    }
  );

  // ── ritual_add_goal ─────────────────────────────────────────────────────────

  server.registerTool(
    "ritual_add_goal",
    {
      description:
        "Add one goal for today via the Pulse ritual API. " +
        "Pulse assigns a UUID, records addedAt, and writes to ~/wiki/ritual/goals/YYYY-MM-DD.json. " +
        "Call once per goal selected during the morning ritual conversation. " +
        "Returns the created goal: { id, text, done: false, addedAt }. " +
        "Source: POST /api/ritual/goals/add — see Pulse modules/ritual.ts.",
      inputSchema: z.object({
        text: z.string().min(1).describe(
          "Goal text to add, e.g. '90-min block: Vision Fillers' or 'Read 30 minutes'"
        ),
      }),
    },
    async ({ text }) => {
      const result = await addGoal(text);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.goal, null, 2));
    }
  );

  // ── ritual_dismiss_goal ─────────────────────────────────────────────────────

  server.registerTool(
    "ritual_dismiss_goal",
    {
      description:
        "Dismiss a rolled-over goal — removes it from today without marking it done or rolling it again. " +
        "Use when reviewing goals from morning_context and kohen doesn't want a rolled-over goal for today. " +
        "Requires the goal's id (from morning_context goals array). " +
        "Source: POST /api/ritual/goals/dismiss — see Pulse modules/ritual.ts.",
      inputSchema: z.object({
        id: z.string().describe("Goal ID from the morning_context goals array"),
      }),
    },
    async ({ id }) => {
      const result = await dismissGoal(id);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify({ ok: true, dismissed: id }, null, 2));
    }
  );

  // ── ritual_toggle_habit ─────────────────────────────────────────────────────

  server.registerTool(
    "ritual_toggle_habit",
    {
      description:
        "Toggle a habit's done/undone state for today via the Pulse ritual API. " +
        "Pulse writes to ~/wiki/ritual/habits/YYYY-MM-DD.json. " +
        "Habit IDs (fixed — defined in Pulse modules/ritual.ts HABIT_DEFS): " +
        "reading (Read 30 min), bible (Bible), workout (Workout), " +
        "text-5 (Text 5 people), water (Gallon of water), " +
        "deep-work (2 deep work sessions), sunlight (30 min sunlight). " +
        "Returns { id, done } reflecting the new state after toggle. " +
        "Source: POST /api/ritual/habits/:id/toggle — see Pulse modules/ritual.ts.",
      inputSchema: z.object({
        habitId: z
          .enum(["reading", "bible", "workout", "text-5", "water", "deep-work", "sunlight"])
          .describe("Habit ID to toggle"),
      }),
    },
    async ({ habitId }) => {
      const result = await toggleHabit(habitId);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );
}
