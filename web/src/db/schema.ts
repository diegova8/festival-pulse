import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Venues ───────────────────────────────────────────
export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 255 }),
  country: varchar("country", { length: 100 }),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Artists ──────────────────────────────────────────
export const artists = pgTable("artists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  bio: text("bio"),
  genres: jsonb("genres").$type<string[]>().default([]),
  imageUrl: text("image_url"),
  raUrl: text("ra_url"),             // Resident Advisor
  youtubeUrl: text("youtube_url"),
  soundcloudUrl: text("soundcloud_url"),
  instagramUrl: text("instagram_url"),
  spotifyUrl: text("spotify_url"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Festivals ────────────────────────────────────────
export const festivals = pgTable("festivals", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  venueId: uuid("venue_id").references(() => venues.id),
  websiteUrl: text("website_url"),
  ticketUrl: text("ticket_url"),
  imageUrl: text("image_url"),
  status: varchar("status", { length: 50 }).default("upcoming"), // upcoming, ongoing, past, cancelled
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Festival Lineups (many-to-many) ─────────────────
export const festivalLineups = pgTable(
  "festival_lineups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    festivalId: uuid("festival_id")
      .references(() => festivals.id, { onDelete: "cascade" })
      .notNull(),
    artistId: uuid("artist_id")
      .references(() => artists.id, { onDelete: "cascade" })
      .notNull(),
    stage: varchar("stage", { length: 255 }),
    performanceDate: date("performance_date"),
    startTime: varchar("start_time", { length: 10 }), // "23:00"
    endTime: varchar("end_time", { length: 10 }),
    isHeadliner: boolean("is_headliner").default(false),
    announcedAt: timestamp("announced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueLineup: uniqueIndex("unique_lineup").on(
      table.festivalId,
      table.artistId
    ),
  })
);

// ─── Scrape Sources ───────────────────────────────────
export const scrapeSources = pgTable("scrape_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // ra, shotgun, dice, instagram, twitter, website
  url: text("url").notNull(),
  config: jsonb("config").default({}),
  enabled: boolean("enabled").default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Scrape Logs ──────────────────────────────────────
export const scrapeLogs = pgTable("scrape_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => scrapeSources.id),
  status: varchar("status", { length: 50 }).notNull(), // success, error, partial
  festivalsFound: integer("festivals_found").default(0),
  artistsFound: integer("artists_found").default(0),
  errors: jsonb("errors").default([]),
  duration: integer("duration_ms"),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
});

// ─── Artist Spotlights (generated content) ────────────
export const artistSpotlights = pgTable("artist_spotlights", {
  id: uuid("id").defaultRandom().primaryKey(),
  artistId: uuid("artist_id")
    .references(() => artists.id, { onDelete: "cascade" })
    .notNull(),
  festivalId: uuid("festival_id").references(() => festivals.id),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  content: text("content").notNull(),          // markdown article
  videoReelUrl: text("video_reel_url"),         // compiled reel
  videoClips: jsonb("video_clips").$type<{
    sourceUrl: string;
    startSec: number;
    endSec: number;
    title: string;
  }[]>().default([]),
  status: varchar("status", { length: 50 }).default("draft"), // draft, published
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
