import { db } from "@/db";
import { artists, artistSpotlights, festivalLineups, festivals, venues } from "@/db/schema";
import { eq, gte, asc } from "drizzle-orm";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 3600;

async function getArtist(slug: string) {
  const results = await db
    .select()
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);

  if (results.length === 0) return null;
  return results[0];
}

async function getArtistEvents(artistId: string) {
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      id: festivals.id,
      name: festivals.name,
      slug: festivals.slug,
      startDate: festivals.startDate,
      venueName: venues.name,
      venueCity: venues.city,
    })
    .from(festivalLineups)
    .innerJoin(festivals, eq(festivalLineups.festivalId, festivals.id))
    .leftJoin(venues, eq(festivals.venueId, venues.id))
    .where(eq(festivalLineups.artistId, artistId))
    .orderBy(asc(festivals.startDate));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: "Artist Not Found" };
  return {
    title: `${artist.name} | Festival Pulse`,
    description: artist.bio || `${artist.name} on Festival Pulse`,
  };
}

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const events = await getArtistEvents(artist.id);
  const genres = (artist.genres as string[]) || [];

  // Fetch video clips from artist spotlights
  const spotlights = await db
    .select()
    .from(artistSpotlights)
    .where(eq(artistSpotlights.artistId, artist.id))
    .limit(1);
  const videoClips = (spotlights[0]?.videoClips as { sourceUrl: string; startSec: number; endSec: number; title: string }[]) || [];

  const links = [
    { label: "Resident Advisor", url: artist.raUrl, icon: "🔊" },
    { label: "Spotify", url: artist.spotifyUrl, icon: "🎵" },
    { label: "SoundCloud", url: artist.soundcloudUrl, icon: "☁️" },
    { label: "YouTube", url: artist.youtubeUrl, icon: "▶️" },
    { label: "Instagram", url: artist.instagramUrl, icon: "📷" },
  ].filter((l) => l.url);

  return (
    <div>
      <Link
        href="/artists"
        className="text-sm text-zinc-500 hover:text-zinc-300 transition"
      >
        ← All Artists
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="text-4xl font-bold">{artist.name}</h1>
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {genres.map((g) => (
              <span
                key={g}
                className="text-xs bg-purple-900/40 text-purple-300 px-3 py-1 rounded-full border border-purple-800/50"
              >
                {g}
              </span>
            ))}
          </div>
        )}
        {artist.bio && (
          <p className="text-zinc-400 mt-4 max-w-3xl leading-relaxed">
            {artist.bio}
          </p>
        )}
      </div>

      {/* Links */}
      {links.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-zinc-300">Links</h2>
          <div className="flex flex-wrap gap-3">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm border border-zinc-800 rounded-lg px-4 py-2 hover:border-zinc-600 hover:bg-zinc-900/50 transition"
              >
                <span>{l.icon}</span>
                <span>{l.label}</span>
                <span className="text-zinc-600">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Featured Sets */}
      {videoClips.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-zinc-300">
            Featured Sets ({videoClips.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videoClips.map((clip, i) => {
              const videoId = clip.sourceUrl.split("v=")[1]?.split("&")[0];
              if (!videoId) return null;
              return (
                <div
                  key={i}
                  className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50"
                >
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?start=${clip.startSec}&autoplay=0`}
                      title={clip.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-zinc-300 font-medium truncate">
                      {clip.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">
          Events ({events.length})
        </h2>
        {events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group flex items-center gap-4 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 hover:bg-zinc-900/50 transition"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 rounded-lg flex flex-col items-center justify-center border border-zinc-700 text-xs">
                  <span className="text-zinc-500 uppercase">
                    {event.startDate
                      ? format(new Date(event.startDate + "T12:00:00"), "MMM")
                      : "TBA"}
                  </span>
                  <span className="text-base font-bold">
                    {event.startDate
                      ? format(new Date(event.startDate + "T12:00:00"), "dd")
                      : "??"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold group-hover:text-purple-400 transition truncate">
                    {event.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    📍 {event.venueName || "TBA"}
                    {event.venueCity ? `, ${event.venueCity}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">No events listed yet.</p>
        )}
      </div>
    </div>
  );
}
