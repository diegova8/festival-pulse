import { db } from "@/db";
import {
  festivals,
  venues,
  festivalLineups,
  artists,
  artistSpotlights,
} from "@/db/schema";
import { eq, gte, lte, asc, desc, and, sql, count } from "drizzle-orm";
import { format } from "date-fns";
import Link from "next/link";

export const revalidate = 3600;

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
    })
    .from(festivals)
    .leftJoin(venues, eq(festivals.venueId, venues.id))
    .where(gte(festivals.startDate, today))
    .orderBy(asc(festivals.startDate));

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

async function getFeaturedArtists() {
  // Get artists with spotlights that have real content
  const results = await db
    .select({
      id: artists.id,
      name: artists.name,
      slug: artists.slug,
      genres: artists.genres,
      imageUrl: artists.imageUrl,
      spotlightTitle: artistSpotlights.title,
    })
    .from(artistSpotlights)
    .innerJoin(artists, eq(artistSpotlights.artistId, artists.id))
    .where(eq(artistSpotlights.status, "published"))
    .limit(6);

  return results;
}

function EventCard({
  event,
  compact = false,
}: {
  event: Awaited<ReturnType<typeof getUpcomingEvents>>[0];
  compact?: boolean;
}) {
  return (
    <div className="group border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-900/50 transition">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-14 h-14 bg-zinc-900 rounded-lg flex flex-col items-center justify-center border border-zinc-700">
          <span className="text-[10px] text-zinc-500 uppercase">
            {event.startDate
              ? format(new Date(event.startDate + "T12:00:00"), "MMM")
              : "TBA"}
          </span>
          <span className="text-lg font-bold">
            {event.startDate
              ? format(new Date(event.startDate + "T12:00:00"), "dd")
              : "??"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/events/${event.slug}`}
            className="text-lg font-semibold hover:text-purple-400 transition truncate block"
          >
            {event.name}
          </Link>
          <p className="text-zinc-500 text-sm mt-0.5">
            📍 {event.venueName || "TBA"}
            {event.venueCity ? `, ${event.venueCity}` : ""}
          </p>
          {!compact && event.artists.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {event.artists.slice(0, 8).map((artist) => (
                <Link
                  key={artist.slug}
                  href={`/artists/${artist.slug}`}
                  className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full hover:bg-zinc-700 transition"
                >
                  {artist.name}
                </Link>
              ))}
              {event.artists.length > 8 && (
                <span className="text-xs text-zinc-600">
                  +{event.artists.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const events = await getUpcomingEvents();
  const featuredArtists = await getFeaturedArtists();

  const today = new Date();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const todayStr = today.toISOString().split("T")[0];
  const weekStr = weekFromNow.toISOString().split("T")[0];

  const thisWeek = events.filter((e) => {
    if (!e.startDate) return false;
    const d = e.startDate.split("T")[0];
    return d >= todayStr && d <= weekStr;
  });

  const envision = events.find((e) =>
    e.name.toLowerCase().includes("envision")
  );

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-12 -mx-6 -mt-6 px-6 pt-16 pb-14 bg-gradient-to-br from-purple-950/80 via-zinc-950 to-emerald-950/60 rounded-b-3xl border-b border-zinc-800/50">
        <div className="max-w-2xl">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-300 via-white to-emerald-300 bg-clip-text text-transparent">
            Festival Pulse
          </h1>
          <p className="text-xl text-zinc-300 mb-2">
            Discover electronic music events in Costa Rica 🇨🇷
          </p>
          <p className="text-zinc-500">
            {events.length} upcoming events · Auto-updated daily from RA & more
          </p>
        </div>
      </div>

      {/* This Week */}
      {thisWeek.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="text-red-400">●</span> Happening This Week
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {thisWeek.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      )}

      {/* Featured Festival — Envision */}
      {envision && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">⭐ Featured Festival</h2>
          <div className="border border-purple-800/50 bg-gradient-to-r from-purple-950/40 to-zinc-900/60 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <Link
                  href={`/events/${envision.slug}`}
                  className="text-2xl font-bold text-purple-300 hover:text-purple-200 transition"
                >
                  {envision.name}
                </Link>
                <p className="text-zinc-400 mt-2">
                  📅{" "}
                  {envision.startDate
                    ? format(
                        new Date(envision.startDate + "T12:00:00"),
                        "MMMM d, yyyy"
                      )
                    : "TBA"}
                  {envision.endDate && envision.endDate !== envision.startDate
                    ? ` — ${format(new Date(envision.endDate + "T12:00:00"), "MMMM d, yyyy")}`
                    : ""}
                </p>
                <p className="text-zinc-500 text-sm mt-1">
                  📍 {envision.venueName || "Uvita, Costa Rica"}
                </p>
                {envision.artists.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                      Lineup ({envision.artists.length} artists)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {envision.artists.map((a) => (
                        <Link
                          key={a.slug}
                          href={`/artists/${a.slug}`}
                          className="text-sm bg-purple-900/30 text-purple-200 px-3 py-1 rounded-full border border-purple-800/40 hover:bg-purple-900/50 transition"
                        >
                          {a.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {envision.websiteUrl && (
                  <a
                    href={envision.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-sm text-purple-400 hover:text-purple-300 transition"
                  >
                    View event details ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Artists */}
      {featuredArtists.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">🎧 Featured Artists</h2>
            <Link
              href="/artists"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {featuredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.slug}`}
                className="group border border-zinc-800 rounded-xl p-4 hover:border-purple-700/50 hover:bg-zinc-900/50 transition text-center"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-600 to-emerald-600 flex items-center justify-center text-lg font-bold">
                  {artist.name.charAt(0)}
                </div>
                <p className="text-sm font-semibold group-hover:text-purple-400 transition truncate">
                  {artist.name}
                </p>
                {(artist.genres as string[])?.length > 0 && (
                  <p className="text-[10px] text-zinc-600 mt-1 truncate">
                    {(artist.genres as string[]).slice(0, 2).join(" · ")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Upcoming Events */}
      <section>
        <h2 className="text-2xl font-bold mb-4">📅 All Upcoming Events</h2>
        <div className="grid gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
          {events.length === 0 && (
            <div className="text-center py-20 text-zinc-600">
              <p className="text-2xl mb-2">🔇</p>
              <p>No upcoming events found. Check back soon!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
