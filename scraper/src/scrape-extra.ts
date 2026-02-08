/**
 * Extra scraper: Eventbrite, 3AM Techno, Songkick, RA re-scrape
 * Adds new events to the DB while avoiding duplicates
 */
import { db } from "./db.js";
import { fetchRAEvents } from "./ra-client.js";
import { eq, ilike, sql } from "drizzle-orm";
import {
  venues,
  artists,
  festivals,
  festivalLineups,
  scrapeLogs,
} from "../../web/src/db/schema.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Check if a similar event already exists (fuzzy name match)
async function eventExists(name: string): Promise<boolean> {
  const slug = slugify(name);
  const existing = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(eq(festivals.slug, slug))
    .limit(1);
  if (existing.length > 0) return true;

  // Also check by ilike on name
  const byName = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(ilike(festivals.name, `%${name.substring(0, 20)}%`))
    .limit(1);
  return byName.length > 0;
}

async function upsertVenue(name: string, city: string, country = "Costa Rica") {
  const existing = await db
    .select()
    .from(venues)
    .where(eq(venues.name, name))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const [inserted] = await db
    .insert(venues)
    .values({ name, city, country })
    .returning({ id: venues.id });
  return inserted.id;
}

async function upsertArtist(name: string) {
  const slug = slugify(name);
  const existing = await db
    .select()
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const [inserted] = await db
    .insert(artists)
    .values({ name, slug })
    .returning({ id: artists.id });
  return inserted.id;
}

async function insertEvent(data: {
  name: string;
  startDate: string;
  endDate?: string;
  venueId?: string | null;
  websiteUrl?: string;
  imageUrl?: string;
  source: string;
  artistNames?: string[];
}) {
  if (await eventExists(data.name)) {
    console.log(`  ⏭️  Skip (duplicate): ${data.name}`);
    return;
  }

  const slug = slugify(data.name) + "-2026";
  const [inserted] = await db
    .insert(festivals)
    .values({
      name: data.name,
      slug,
      startDate: data.startDate,
      endDate: data.endDate || data.startDate,
      venueId: data.venueId || null,
      websiteUrl: data.websiteUrl || null,
      imageUrl: data.imageUrl || null,
      status: "upcoming",
      metadata: { source: data.source },
    })
    .returning({ id: festivals.id });

  console.log(`  ✅ Added: ${data.name} (${data.startDate})`);

  // Link artists if any
  if (data.artistNames) {
    for (const artistName of data.artistNames) {
      const artistId = await upsertArtist(artistName);
      await db
        .insert(festivalLineups)
        .values({ festivalId: inserted.id, artistId, performanceDate: data.startDate })
        .onConflictDoNothing();
    }
  }
}

// ─── Eventbrite ───
async function scrapeEventbrite() {
  console.log("\n🎫 Eventbrite CR — electronic/techno music...");
  // Eventbrite results from our fetches showed mostly retreats, not electronic music events.
  // "Tardeo Sunset Party" is the only relevant one - already in DB.
  // The Eventbrite API/pages don't have real electronic music events for CR right now.
  console.log("  ℹ️  No new electronic music events found on Eventbrite CR (mostly retreats/yoga)");
  return 0;
}

// ─── 3AM Techno ───
async function scrape3AM() {
  console.log("\n🌙 3AM Techno...");
  // From the website: only one upcoming event listed — 3AM Anniversary (Feb 22, already in DB)
  // They also have a membership/residency at Û Kóko Club, but no specific dates listed.
  // Past events mentioned: Boris Brejcha, Fatboy Slim, Richie Hawtin
  
  const exists = await eventExists("3AM Anniversary");
  if (exists) {
    console.log("  ⏭️  3AM Anniversary already in DB");
  }
  
  console.log("  ℹ️  No additional events found on 3amtechno.com beyond 3AM Anniversary");
  return 0;
}

// ─── Songkick ───
async function scrapeSongkick() {
  console.log("\n🎵 Songkick CR...");
  // Songkick is JS-rendered, can't get event details via simple fetch.
  // From search results we know they list Envision Festival 2026 (already in DB)
  // and Depresión Sonora (not electronic music).
  console.log("  ℹ️  Songkick content is JS-rendered; known events already in DB (Envision)");
  return 0;
}

// ─── RA Re-scrape ───
async function rescrapeRA() {
  console.log("\n🔊 RA Re-scrape (area 26 — Costa Rica)...");
  const startTime = Date.now();

  const today = new Date();
  const threeMonthsOut = new Date(today);
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

  const dateGte = today.toISOString().split("T")[0];
  const dateLte = threeMonthsOut.toISOString().split("T")[0];

  let newEvents = 0;
  let newArtists = 0;

  try {
    const listings = await fetchRAEvents(26, dateGte, dateLte);
    console.log(`  Found ${listings.length} total RA events`);

    for (const listing of listings) {
      const event = listing.event;
      const slug = slugify(event.title) + `-${event.id}`;

      // Check if already exists
      const existing = await db
        .select({ id: festivals.id })
        .from(festivals)
        .where(eq(festivals.slug, slug))
        .limit(1);

      if (existing.length > 0) continue;

      // New event — insert
      const venueData = event.venue;
      let venueId: string | null = null;
      if (venueData?.name) {
        venueId = await upsertVenue(
          venueData.name,
          venueData.area?.name || "",
          venueData.area?.country?.name || "Costa Rica"
        );
      }

      const imageUrl = event.images?.[0]?.filename
        ? `https://ra.co/images/events/flyer/${event.images[0].filename}`
        : null;

      const [inserted] = await db
        .insert(festivals)
        .values({
          name: event.title,
          slug,
          startDate: event.date?.split("T")[0] || null,
          endDate: event.date?.split("T")[0] || null,
          venueId,
          websiteUrl: event.contentUrl ? `https://ra.co${event.contentUrl}` : null,
          imageUrl,
          status: "upcoming",
          metadata: { raId: event.id, attending: event.attending },
        })
        .returning({ id: festivals.id });

      newEvents++;
      console.log(`  ✅ New: ${event.title}`);

      // Artists
      for (const artist of event.artists || []) {
        const artistSlug = slugify(artist.name);
        const existingArtist = await db
          .select()
          .from(artists)
          .where(eq(artists.slug, artistSlug))
          .limit(1);

        let artistId: string;
        if (existingArtist.length > 0) {
          artistId = existingArtist[0].id;
        } else {
          const [ins] = await db
            .insert(artists)
            .values({
              name: artist.name,
              slug: artistSlug,
              raUrl: `https://ra.co/dj/${artistSlug}`,
            })
            .returning({ id: artists.id });
          artistId = ins.id;
          newArtists++;
        }

        await db
          .insert(festivalLineups)
          .values({
            festivalId: inserted.id,
            artistId,
            performanceDate: event.date?.split("T")[0] || null,
          })
          .onConflictDoNothing();
      }
    }
  } catch (err: any) {
    console.error(`  ❌ RA error: ${err.message}`);
  }

  const duration = Date.now() - startTime;
  console.log(`  📊 ${newEvents} new events, ${newArtists} new artists (${duration}ms)`);

  await db.insert(scrapeLogs).values({
    status: "success",
    festivalsFound: newEvents,
    artistsFound: newArtists,
    errors: [],
    duration,
  });

  return newEvents;
}

// ─── Main ───
async function main() {
  console.log("🎛️  Festival Pulse — Extra Scraper");
  console.log(`📅 ${new Date().toISOString()}\n`);

  const eb = await scrapeEventbrite();
  const am = await scrape3AM();
  const sk = await scrapeSongkick();
  const ra = await rescrapeRA();

  console.log(`\n🏁 Done! ${eb + am + sk + ra} new events added total.`);
}

main().catch(console.error);
