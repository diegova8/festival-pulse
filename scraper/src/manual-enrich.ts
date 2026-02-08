import { db } from "./db";
import { eq, ilike, and, sql } from "drizzle-orm";
import {
  venues,
  artists,
  festivals,
  festivalLineups,
  artistSpotlights,
} from "../../web/src/db/schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  console.log("=== Manual Enrich Script ===\n");

  // ─── 1. Update Envision Festival 2026 ───────────────
  console.log("1. Updating Envision Festival 2026...");

  // Upsert venue
  const existingVenues = await db
    .select()
    .from(venues)
    .where(ilike(venues.name, "%Rancho La Merced%"));

  let venueId: string;
  if (existingVenues.length > 0) {
    venueId = existingVenues[0].id;
    await db
      .update(venues)
      .set({
        city: "Uvita, Puntarenas",
        country: "Costa Rica",
        updatedAt: new Date(),
      })
      .where(eq(venues.id, venueId));
  } else {
    const [newVenue] = await db
      .insert(venues)
      .values({
        name: "Rancho La Merced",
        city: "Uvita, Puntarenas",
        country: "Costa Rica",
      })
      .returning();
    venueId = newVenue.id;
  }
  console.log(`  Venue: Rancho La Merced (${venueId})`);

  // Find Envision festival
  const envisionRows = await db
    .select()
    .from(festivals)
    .where(ilike(festivals.name, "%Envision%"));

  if (envisionRows.length === 0) {
    console.error("  ERROR: Envision Festival not found in DB!");
    return;
  }

  const envisionId = envisionRows[0].id;
  await db
    .update(festivals)
    .set({
      startDate: "2026-02-23",
      endDate: "2026-03-02",
      venueId,
      websiteUrl: "https://www.envisionfestival.com/",
      status: "upcoming",
      updatedAt: new Date(),
    })
    .where(eq(festivals.id, envisionId));
  console.log(`  Updated Envision (${envisionId})`);

  // Upsert artists and link to Envision
  const artistNames = [
    "Bob Moses", "CloZee", "Daily Bread", "Emancipator", "Polo & Pan",
    "Damian Lazarus", "Dezarie", "Ivy Lab", "Memba", "Shima",
    "Chancha Via Circuito", "Grouch in Dub", "Christian Löffler",
    "Parra for Cuva", "Justin Martin", "Rampue", "5AM Trio", "Magpie Jay",
    "Mfinity", "Nina", "Nominus", "Oveous", "Yoko", "Nickodemus", "Juju",
    "Camilo", "Zuma Dionys",
  ];

  for (const name of artistNames) {
    const slug = slugify(name);
    // Upsert artist
    const existing = await db
      .select()
      .from(artists)
      .where(eq(artists.slug, slug));

    let artistId: string;
    if (existing.length > 0) {
      artistId = existing[0].id;
    } else {
      const [newArtist] = await db
        .insert(artists)
        .values({ name, slug })
        .returning();
      artistId = newArtist.id;
      console.log(`  Created artist: ${name}`);
    }

    // Link to Envision (upsert)
    await db
      .insert(festivalLineups)
      .values({ festivalId: envisionId, artistId })
      .onConflictDoNothing();
  }
  console.log(`  Linked ${artistNames.length} artists to Envision`);

  // ─── 2. Tardeo Sunset Party ─────────────────────────
  console.log("\n2. Adding Tardeo Sunset Party...");

  const tardeoSlug = "tardeo-sunset-party-2026";
  const existingTardeo = await db
    .select()
    .from(festivals)
    .where(eq(festivals.slug, tardeoSlug));

  if (existingTardeo.length === 0) {
    // Create venue
    const [tardeoVenue] = await db
      .insert(venues)
      .values({ name: "San Ramon", city: "San Ramon", country: "Costa Rica" })
      .returning();

    await db.insert(festivals).values({
      name: "Tardeo Sunset Party",
      slug: tardeoSlug,
      startDate: "2026-02-15",
      endDate: "2026-02-15",
      venueId: tardeoVenue.id,
      status: "upcoming",
    });
    console.log("  Added Tardeo Sunset Party");
  } else {
    console.log("  Already exists, skipping");
  }

  // ─── 3. 3AM Anniversary ────────────────────────────
  console.log("\n3. Adding 3AM Anniversary...");

  const threeAmSlug = "3am-anniversary-2026";
  const existing3am = await db
    .select()
    .from(festivals)
    .where(eq(festivals.slug, threeAmSlug));

  if (existing3am.length === 0) {
    // Create venue
    const [kokoVenue] = await db
      .insert(venues)
      .values({
        name: "Û Kóko Club",
        city: "San José",
        country: "Costa Rica",
      })
      .returning();

    await db.insert(festivals).values({
      name: "3AM Anniversary",
      slug: threeAmSlug,
      startDate: "2026-02-22",
      endDate: "2026-02-22",
      venueId: kokoVenue.id,
      status: "upcoming",
    });
    console.log("  Added 3AM Anniversary");
  } else {
    console.log("  Already exists, skipping");
  }

  // ─── 4. Clean up YouTube embeds ─────────────────────
  console.log("\n4. Cleaning up YouTube embeds...");

  const spotlights = await db.select().from(artistSpotlights);
  console.log(`  Found ${spotlights.length} spotlights`);

  for (const spotlight of spotlights) {
    // Get artist name
    const [artist] = await db
      .select()
      .from(artists)
      .where(eq(artists.id, spotlight.artistId));

    if (!artist) continue;

    const clips = (spotlight.videoClips || []) as {
      sourceUrl: string;
      startSec: number;
      endSec: number;
      title: string;
    }[];

    if (clips.length === 0) continue;

    const artistNameLower = artist.name.toLowerCase();
    // Also check individual words for multi-word artist names
    const nameWords = artistNameLower.split(/\s+/).filter((w) => w.length > 2);

    const validClips = clips.filter((clip) => {
      const titleLower = (clip.title || "").toLowerCase();
      // Check if title contains artist name or significant parts of it
      if (titleLower.includes(artistNameLower)) return true;
      // Check if any significant name word appears
      if (nameWords.some((word) => titleLower.includes(word))) return true;
      return false;
    });

    if (validClips.length !== clips.length) {
      const removed = clips.length - validClips.length;
      console.log(
        `  ${artist.name}: removed ${removed}/${clips.length} mismatched clips`
      );
      await db
        .update(artistSpotlights)
        .set({ videoClips: validClips, updatedAt: new Date() })
        .where(eq(artistSpotlights.id, spotlight.id));
    }
  }

  console.log("\n=== Done! ===");
}

main().catch(console.error);
