/**
 * Syncs RA events into our database
 */
import { db } from "./db.js";
import { fetchRAEvents, RAEventListing, RA_AREAS } from "./ra-client.js";
import { eq } from "drizzle-orm";
import {
  venues,
  artists,
  festivals,
  festivalLineups,
  scrapeSources,
  scrapeLogs,
} from "../../web/src/db/schema.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function upsertVenue(event: RAEventListing["event"]) {
  const v = event.venue;
  if (!v?.name) return null;

  const slug = `ra-venue-${v.id}`;
  const existing = await db
    .select()
    .from(venues)
    .where(eq(venues.name, v.name))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [inserted] = await db
    .insert(venues)
    .values({
      name: v.name,
      city: v.area?.name || null,
      country: v.area?.country?.name || null,
      address: v.address || null,
    })
    .returning({ id: venues.id });

  return inserted.id;
}

async function upsertArtist(artist: { id: string; name: string }) {
  const slug = slugify(artist.name);
  const existing = await db
    .select()
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [inserted] = await db
    .insert(artists)
    .values({
      name: artist.name,
      slug,
      raUrl: `https://ra.co/dj/${slug}`,
    })
    .returning({ id: artists.id });

  return inserted.id;
}

async function upsertFestival(
  event: RAEventListing["event"],
  venueId: string | null
) {
  const slug = slugify(event.title) + `-${event.id}`;
  const existing = await db
    .select()
    .from(festivals)
    .where(eq(festivals.slug, slug))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

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
      venueId: venueId,
      websiteUrl: event.contentUrl
        ? `https://ra.co${event.contentUrl}`
        : null,
      imageUrl,
      status: "upcoming",
      metadata: { raId: event.id, attending: event.attending },
    })
    .returning({ id: festivals.id });

  return inserted.id;
}

async function syncArea(areaName: string, areaId: number, dateGte: string, dateLte: string) {
  console.log(`\n🔍 Scraping ${areaName} (area ${areaId}) from ${dateGte} to ${dateLte}...`);
  const startTime = Date.now();

  let festivalsFound = 0;
  let artistsFound = 0;
  const errors: string[] = [];

  try {
    const listings = await fetchRAEvents(areaId, dateGte, dateLte);
    console.log(`  Found ${listings.length} events`);

    for (const listing of listings) {
      try {
        const event = listing.event;

        // Upsert venue
        const venueId = await upsertVenue(event);

        // Upsert festival/event
        const festivalId = await upsertFestival(event, venueId);
        festivalsFound++;

        // Upsert artists & lineups
        for (const artist of event.artists || []) {
          try {
            const artistId = await upsertArtist(artist);
            artistsFound++;

            // Link artist to festival
            await db
              .insert(festivalLineups)
              .values({
                festivalId,
                artistId,
                performanceDate: event.date?.split("T")[0] || null,
                startTime: event.startTime?.split("T")[1]?.slice(0, 5) || null,
                endTime: event.endTime?.split("T")[1]?.slice(0, 5) || null,
              })
              .onConflictDoNothing();
          } catch (err: any) {
            errors.push(`Artist ${artist.name}: ${err.message}`);
          }
        }
      } catch (err: any) {
        errors.push(`Event ${listing.event?.title}: ${err.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Area ${areaName}: ${err.message}`);
  }

  const duration = Date.now() - startTime;
  console.log(`  ✅ ${festivalsFound} events, ${artistsFound} artist slots in ${duration}ms`);
  if (errors.length > 0) console.log(`  ⚠️  ${errors.length} errors`);

  // Log the scrape
  await db.insert(scrapeLogs).values({
    status: errors.length > 0 ? "partial" : "success",
    festivalsFound,
    artistsFound,
    errors: errors.slice(0, 20), // cap at 20
    duration,
  });

  return { festivalsFound, artistsFound, errors };
}

// --- Main ---
async function main() {
  const today = new Date();
  const threeMonthsOut = new Date(today);
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

  const dateGte = today.toISOString().split("T")[0];
  const dateLte = threeMonthsOut.toISOString().split("T")[0];

  console.log("🎛️  Festival Pulse — RA Scraper");
  console.log(`📅 Range: ${dateGte} → ${dateLte}\n`);

  let totalFestivals = 0;
  let totalArtists = 0;

  // MVP: Costa Rica only
  const targetAreas: [string, number][] = [
    ["Costa Rica", 26],
  ];

  for (const [name, id] of targetAreas) {
    const result = await syncArea(name, id, dateGte, dateLte);
    totalFestivals += result.festivalsFound;
    totalArtists += result.artistsFound;
  }

  console.log(`\n🏁 Done! ${totalFestivals} events, ${totalArtists} artist slots synced.`);
}

main().catch(console.error);
