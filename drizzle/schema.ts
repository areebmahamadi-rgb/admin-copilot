import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Draft edits table — stores user corrections to AI-generated drafts
// Used to learn from edits and calibrate future draft generation
export const draftEdits = mysqlTable("draft_edits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  sender: varchar("sender", { length: 320 }),
  originalDraft: text("originalDraft").notNull(),
  editedDraft: text("editedDraft").notNull(),
  itemTitle: varchar("itemTitle", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DraftEdit = typeof draftEdits.$inferSelect;
export type InsertDraftEdit = typeof draftEdits.$inferInsert;