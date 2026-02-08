import { db } from "@/db";
import { artists, festivalLineups, festivals } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const revalidate = 3600;

async function getArtists() {
  const results = await db
    .select({
      id: artists.id,
      name: artists.name,
      slug: artists.slug,
      bio: artists.bio,
      genres: artists.genres,
      imageUrl: artists.imageUrl,
      raUrl: artists.raUrl,
    })
    .from(artists)
    .orderBy(asc(artists.name));

  const artistsWithEvents = await Promise.all(
    results.map(async (artist) => {
      const events = await db
        .select({ name: festivals.name, startDate: festivals.startDate })
        .from(festivalLineups)
        .innerJoin(festivals, eq(festivalLineups.festivalId, festivals.id))
        .where(eq(festivalLineups.artistId, artist.id));
      return { ...artist, events };
    })
  );

  return artistsWithEvents;
}

export default async function ArtistsPage() {
  const allArtists = await getArtists();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Artists</h1>
        <p className="text-zinc-500">
          {allArtists.length} artists playing upcoming events in Costa Rica
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allArtists.map((artist) => (
          <a
            key={artist.id}
            href={artist.raUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-900/50 transition"
          >
            <h2 className="font-semibold text-lg group-hover:text-purple-400 transition">
              {artist.name}
            </h2>
            {artist.events.length > 0 && (
              <div className="mt-2 space-y-1">
                {artist.events.map((event, i) => (
                  <p key={i} className="text-xs text-zinc-500">
                    🎛️ {event.name}
                  </p>
                ))}
              </div>
            )}
            {artist.raUrl && (
              <p className="text-xs text-zinc-600 mt-2">View on RA ↗</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
