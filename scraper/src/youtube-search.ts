import { execSync } from "child_process";

export interface VideoClip {
  sourceUrl: string;
  startSec: number;
  endSec: number;
  title: string;
}

export async function searchYouTube(artistName: string): Promise<VideoClip[]> {
  const query = `${artistName} DJ set live performance`;
  try {
    const raw = execSync(
      `yt-dlp "ytsearch3:${query.replace(/"/g, '\\"')}" --flat-playlist --no-download --print "%(id)s|||%(title)s|||%(duration)s"`,
      { env: { ...process.env, PATH: `${process.env.HOME}/.deno/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` }, timeout: 30000, encoding: "utf-8" }
    );

    return raw.trim().split("\n").filter(Boolean).map((line) => {
      const [id, title, durStr] = line.split("|||");
      const duration = parseFloat(durStr) || 3600;
      const startSec = Math.round(duration * 0.3);
      const endSec = Math.min(startSec + 60, Math.round(duration));
      return {
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
        startSec,
        endSec,
        title: title || `${artistName} set`,
      };
    });
  } catch (e: any) {
    console.error(`YouTube search failed for ${artistName}:`, e.message);
    return [];
  }
}
