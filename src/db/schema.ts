import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// --- Enums ---------------------------------------------------------------

export const userRole = pgEnum("user_role", ["owner", "co_owner", "manager"]);
export const userLocale = pgEnum("user_locale", ["en", "es"]);

export const propertyType = pgEnum("property_type", [
  "apartment",
  "maisonette",
  "penthouse",
  "townhouse",
  "villa",
  "garage",
  "airspace",
]);

export const taxElection = pgEnum("tax_election", ["FWT_15", "standard_rates"]);

export const expenseCategory = pgEnum("expense_category", [
  "white_goods",
  "repair_over_200",
  "utilities",
  "other",
]);

export const expenseStatus = pgEnum("expense_status", ["pending", "approved", "rejected"]);

export const rentStatus = pgEnum("rent_status", ["pending", "confirmed"]);

export const workStatus = pgEnum("work_status", [
  "scheduled",
  "in_progress",
  "done",
  "cancelled",
]);

// --- Reference data ------------------------------------------------------

// Spec §5: pre-seeded list of Maltese localities, dropdown only, no free text.
export const malteseLocalities = pgTable("maltese_localities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nameEn: varchar("name_en", { length: 80 }).notNull().unique(),
  nameMt: varchar("name_mt", { length: 80 }).notNull(),
});

// Spec §5: rebate bands maintained as a config table, updated when CfR publishes.
// Rebate amount is per-year, derived from (bedrooms × duration band).
export const rebateBands = pgTable(
  "rebate_bands",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    bedrooms: integer("bedrooms").notNull(),
    minDurationYears: integer("min_duration_years").notNull(),
    annualRebateCents: integer("annual_rebate_cents").notNull(),
    effectiveFrom: date("effective_from").notNull(),
  },
  (t) => [
    uniqueIndex("rebate_bands_unique_idx").on(t.bedrooms, t.minDurationYears, t.effectiveFrom),
    check("rebate_bands_bedrooms_check", sql`${t.bedrooms} >= 0`),
    check("rebate_bands_duration_check", sql`${t.minDurationYears} >= 0`),
    check("rebate_bands_amount_check", sql`${t.annualRebateCents} >= 0`),
  ],
);

// --- Users ---------------------------------------------------------------

// Mirrors auth.users (Supabase). RLS policies reference auth.uid() = id.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // matches auth.users.id
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  locale: userLocale("locale").notNull().default("en"),
  role: userRole("role").notNull(),
  // Spec §4: encrypted at rest. Stored as ciphertext base64; encrypt in app layer.
  googleRefreshToken: text("google_refresh_token"),
  pushSubscriptions: jsonb("push_subscriptions").$type<PushSubscriptionJson[]>().notNull().default(sql`'[]'::jsonb`),
  // Per-user secret used in the public iCal feed URL (spec §8). Rotatable.
  icalToken: varchar("ical_token", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PushSubscriptionJson = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

// --- Properties ----------------------------------------------------------

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 120 }).notNull(),
  addressLine: varchar("address_line", { length: 240 }).notNull(),
  localityId: integer("locality_id")
    .notNull()
    .references(() => malteseLocalities.id, { onDelete: "restrict" }),
  postCode: varchar("post_code", { length: 10 }).notNull(),
  type: propertyType("type").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  photos: jsonb("photos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // Spec §4: per tax_year override allowed via tax_elections.
  defaultTaxElection: taxElection("default_tax_election").notNull().default("FWT_15"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Ownership splits ----------------------------------------------------

// Spec §4: property_id null = default for all properties of that owner.
// Constraint: per (property_id, effective_from), sum of percentages = 100.
// Sum constraint enforced application-side (Postgres can't do cross-row CHECK without trigger).
export const ownershipSplits = pgTable(
  "ownership_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // basis points (e.g. 5000 = 50.00%) — avoids float in shares.
    percentageBps: integer("percentage_bps").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ownership_splits_bps_range", sql`${t.percentageBps} > 0 AND ${t.percentageBps} <= 10000`),
  ],
);

// --- Leases --------------------------------------------------------------

export const leases = pgTable("leases", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  managerId: uuid("manager_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  monthlyFeeCents: integer("monthly_fee_cents").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  // Spec §4: Housing Authority lease registration number.
  llNumber: varchar("ll_number", { length: 40 }),
  haRegistered: boolean("ha_registered").notNull().default(false),
  // Spec §4: derived from bedrooms + duration. Cached here for TA24 export.
  rebateBandId: integer("rebate_band_id").references(() => rebateBands.id),
  // Spec §5: Article 31E reduced 5% rate eligibility marker.
  article31EFlag: boolean("article_31e_flag").notNull().default(false),
  // Spec §7: handover notes written when lease ends.
  handoverNotes: text("handover_notes"),
  // Optional uploaded lease PDF.
  leasePdfUrl: text("lease_pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Tax elections -------------------------------------------------------

// Spec §4: one election per owner per year, applies to all their properties.
export const taxElections = pgTable(
  "tax_elections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taxYear: integer("tax_year").notNull(),
    election: taxElection("election").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tax_elections_owner_year_idx").on(t.ownerId, t.taxYear),
    check("tax_elections_year_check", sql`${t.taxYear} >= 2020 AND ${t.taxYear} <= 2100`),
  ],
);

// --- Approval rules ------------------------------------------------------

// Spec §4: property_id null = global rule. Threshold default €500.
export const approvalRules = pgTable("approval_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  thresholdCents: integer("threshold_cents").notNull().default(50000),
  requiredApprovers: jsonb("required_approvers").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Rent payments -------------------------------------------------------

export const rentPayments = pgTable("rent_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  leaseId: uuid("lease_id")
    .notNull()
    .references(() => leases.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  paidOn: date("paid_on").notNull(),
  loggedBy: uuid("logged_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  receiptUrl: text("receipt_url"),
  status: rentStatus("status").notNull().default("pending"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Expenses ------------------------------------------------------------

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  category: expenseCategory("category").notNull(),
  description: text("description").notNull(),
  incurredOn: date("incurred_on").notNull(),
  loggedBy: uuid("logged_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  receiptUrl: text("receipt_url").notNull(), // spec §9: required
  status: expenseStatus("status").notNull().default("pending"),
  approvalLog: jsonb("approval_log").$type<ApprovalLogEntry[]>().notNull().default(sql`'[]'::jsonb`),
  // Spec §4 / §9: auto-archive 12 months after creation.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApprovalLogEntry = {
  userId: string;
  action: "approved" | "rejected";
  comment?: string;
  at: string;
};

// --- Works ---------------------------------------------------------------

export const works = pgTable("works", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  assignedTo: uuid("assigned_to").references(() => users.id),
  status: workStatus("status").notNull().default("scheduled"),
  googleEventId: text("google_event_id"),
  beforePhotos: jsonb("before_photos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  afterPhotos: jsonb("after_photos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Messages ------------------------------------------------------------

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  bodyOriginal: text("body_original").notNull(),
  bodyLang: varchar("body_lang", { length: 5 }).notNull(),
  bodyTranslatedEn: text("body_translated_en"),
  bodyTranslatedEs: text("body_translated_es"),
  attachments: jsonb("attachments").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Audit log -----------------------------------------------------------

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Invites (manager + co-owner onboarding, spec §13) -------------------

// Token itself is not stored; we store a hash so accept can verify.
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  role: userRole("role").notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // For managers: which properties they get assigned to on accept.
  // For co-owners: optional default split percentage applied via ownership_splits.
  metadata: jsonb("metadata").$type<InviteMetadata>().notNull().default(sql`'{}'::jsonb`),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InviteMetadata = {
  propertyIds?: string[];
  defaultSplitBps?: number;
};

// --- Notification preferences (spec §11: per channel per type) ----------

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    push: boolean("push").notNull().default(true),
    email: boolean("email").notNull().default(true),
    digest: boolean("digest").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventType] })],
);
