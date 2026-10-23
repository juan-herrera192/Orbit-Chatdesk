import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const orbitWorkspaces = pgTable("orbit_workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  publicKey: text("public_key").notNull().unique(),
  inviteCode: text("invite_code").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orbitMembers = pgTable("orbit_members", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => orbitWorkspaces.id),
  name: text("name").notNull(),
  role: text("role").notNull().default("Agent"),
}, table => [index("orbit_member_workspace").on(table.workspaceId)]);

export const orbitConversations = pgTable("orbit_conversations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => orbitWorkspaces.id),
  tokenHash: text("token_hash").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("orbit_chat_workspace").on(table.workspaceId)]);
