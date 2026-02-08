import { db } from "@/db";
import { festivals, venues, festivalLineups, artists } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 3600;

async function getEvent(slug: string) {
  const results = await db
    .select({
      id: festivals.id,
      name: festivals.name,
      slug: festivals.slug,
      description: festivals.description,
      startDate: festivals.startDate,
      endDate: festivals.endDate,
      websiteUrl: festivals.websiteUrl,
      ticketUrl: festivals.ticketUrl,
      imageUrl: festivals.imageUrl,
      status: festivals.status,
      venueName: venues.name,
      venueCity: venues.city,
      venueCountry: venues.country,
      venueAddress: venues.address,
    })
    .from(festivals)
    .leftJoin(venues, eq(festivals.venueId, venues.id))
    .where(eq(festivals.slug, slug))
    .limit(1);

  if (results.length === 0) return null;
  return results[0];
}

async function getEventLineup(festivalId: string) {
  return db
    .select({
      name: artists.name,
      slug: artists.slug,
      isHeadliner: festivalLineups.isHeadliner,
    })
    .from(festivalLineups)
    .innerJoin(artists, eq(festivalLineups.artistId, artists.id))
    .where(eq(festivalLineups.festivalId, festivalId))
    .orderBy(asc(artists.name));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event Not Found" };
  return {
    title: `${event.name} | Festival Pulse`,
    description: event.description || `${event.name} on Festival Pulse`,
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const lineup = await getEventLineup(event.id);

  const formatDate = (d: string | null) =>
    d ? format(new Date(d + "T12:00:00"), "EEEE, MMMM d, yyyy") : null;

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-300 transition"
      >
        ← All Events
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="text-4xl font-bold">{event.name}</h1>

        <div className="mt-4 space-y-2 text-zinc-400">
          {event.startDate && (
            <p>
              📅{" "}
              {formatDate(event.startDate)}
              {event.endDate && event.endDate !== event.startDate
                ? ` — ${formatDate(event.endDate)}`
                : ""}
            </p>
          )}
          <p>
            📍 {event.venueName || "TBA"}
            {event.venueCity ? `, ${event.venueCity}` : ""}
            {event.venueCountry ? `, ${event.venueCountry}` : ""}
          </p>
          {event.venueAddress && (
            <p className="text-sm text-zinc-500">🗺️ {event.venueAddress}</p>
          )}
        </div>

        {event.description && (
          <p className="text-zinc-400 mt-4 max-w-3xl leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Action links */}
        <div className="flex flex-wrap gap-3 mt-6">
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
            >
              🎟️ Get Tickets ↗
            </a>
          )}
          {event.websiteUrl && (
            <a
              href={event.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-sm px-5 py-2.5 rounded-lg transition"
            >
              View on RA ↗
            </a>
          )}
        </div>
      </div>

      {/* Lineup */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">
          Lineup ({lineup.length})
        </h2>
        {lineup.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lineup.map((artist) => (
              <Link
                key={artist.slug}
                href={`/artists/${artist.slug}`}
                className="group flex items-center gap-3 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 hover:bg-zinc-900/50 transition"
              >
                <span className="font-semibold group-hover:text-purple-400 transition">
                  {artist.name}
                </span>
                {artist.isHeadliner && (
                  <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800/50">
                    Headliner
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">Lineup not announced yet.</p>
        )}
      </div>
    </div>
  );
}
