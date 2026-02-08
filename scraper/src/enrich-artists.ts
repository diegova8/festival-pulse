import { db } from "./db";
import { searchYouTube } from "./youtube-search";
import { eq } from "drizzle-orm";
import { artists, artistSpotlights } from "../../web/src/db/schema";

async function main() {
  console.log("Fetching artists...");
  const allArtists = await db.select().from(artists);
  console.log(`Found ${allArtists.length} artists`);

  for (const artist of allArtists) {
    console.log(`\nSearching YouTube for: ${artist.name}`);
    const clips = await searchYouTube(artist.name);

    if (clips.length === 0) {
      console.log(`  No clips found, skipping`);
      continue;
    }

    console.log(`  Found ${clips.length} clips`);

    // Check if spotlight exists
    const existing = await db
      .select()
      .from(artistSpotlights)
      .where(eq(artistSpotlights.artistId, artist.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(artistSpotlights)
        .set({ videoClips: clips, updatedAt: new Date() })
        .where(eq(artistSpotlights.id, existing[0].id));
      console.log(`  Updated existing spotlight`);
    } else {
      const slug = `${artist.slug}-featured-sets`;
      await db.insert(artistSpotlights).values({
        artistId: artist.id,
        title: `${artist.name} – Featured Sets`,
        slug,
        content: `Featured DJ sets and live performances by ${artist.name}.`,
        videoClips: clips,
        status: "published",
        publishedAt: new Date(),
      });
      console.log(`  Created new spotlight`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
