import { db } from "@/db";
import { festivals, venues, festivalLineups, artists } from "@/db/schema";
import { eq, gte, asc } from "drizzle-orm";
import { format } from "date-fns";

export const revalidate = 3600; // revalidate every hour

async function getUpcomingEvents() {
  const today = new Date().toISOString().split("T")[0];

  const results = await db
    .select({
      id: festivals.id,
      name: festivals.name,
      slug: festivals.slug,
      startDate: festivals.startDate,
      endDate: festivals.endDate,
      imageUrl: festivals.imageUrl,
      websiteUrl: festivals.websiteUrl,
      status: festivals.status,
      venueName: venues.name,
      venueCity: venues.city,
      venueCountry: venues.country,
    })
    .from(festivals)
    .leftJoin(venues, eq(festivals.venueId, venues.id))
    .where(gte(festivals.startDate, today))
    .orderBy(asc(festivals.startDate));

  // Get artists for each festival
  const eventsWithArtists = await Promise.all(
    results.map(async (event) => {
      const lineup = await db
        .select({ name: artists.name, slug: artists.slug })
        .from(festivalLineups)
        .innerJoin(artists, eq(festivalLineups.artistId, artists.id))
        .where(eq(festivalLineups.festivalId, event.id));
      return { ...event, artists: lineup };
    })
  );

  return eventsWithArtists;
}

export default async function Home() {
  const events = await getUpcomingEvents();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">
          Upcoming Events{" "}
          <span className="text-zinc-500">in Costa Rica</span>
        </h1>
        <p className="text-zinc-500">
          {events.length} events found · Auto-updated daily from RA & more
        </p>
      </div>

      <div className="grid gap-6">
        {events.map((event) => (
          <a
            key={event.id}
            href={event.websiteUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border border-zinc-800 rounded-xl p-6 hover:border-zinc-600 hover:bg-zinc-900/50 transition"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Date badge */}
              <div className="flex-shrink-0 w-16 h-16 bg-zinc-900 rounded-lg flex flex-col items-center justify-center border border-zinc-700">
                <span className="text-xs text-zinc-500 uppercase">
                  {event.startDate
                    ? format(new Date(event.startDate + "T12:00:00"), "MMM")
                    : "TBA"}
                </span>
                <span className="text-xl font-bold">
                  {event.startDate
                    ? format(new Date(event.startDate + "T12:00:00"), "dd")
                    : "??"}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold group-hover:text-purple-400 transition truncate">
                  {event.name}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                  📍 {event.venueName || "TBA"}
                  {event.venueCity ? `, ${event.venueCity}` : ""}
                </p>
                {event.artists.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {event.artists.map((artist) => (
                      <span
                        key={artist.slug}
                        className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full"
                      >
                        {artist.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 text-zinc-600 group-hover:text-zinc-400 transition">
                ↗
              </div>
            </div>
          </a>
        ))}

        {events.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-2xl mb-2">🔇</p>
            <p>No upcoming events found. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
