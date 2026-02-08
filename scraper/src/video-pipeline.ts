/**
 * Video Reel Pipeline
 * 1. Search YouTube for artist DJ sets / performances
 * 2. Download best clips
 * 3. Extract highlight segments (intro/peak moments)
 * 4. Compile into a short reel (60-90 sec)
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import path from "path";

const VIDEOS_DIR = "/home/ubuntu/.openclaw/workspace/festival-pulse/videos";
const REELS_DIR = "/home/ubuntu/.openclaw/workspace/festival-pulse/reels";

// Ensure dirs exist
[VIDEOS_DIR, REELS_DIR].forEach((d) => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

interface ClipInfo {
  sourceUrl: string;
  title: string;
  startSec: number;
  endSec: number;
  localPath: string;
}

/**
 * Search YouTube for an artist's best content
 */
export function searchYouTube(
  artistName: string,
  maxResults = 3
): { url: string; title: string; duration: number }[] {
  try {
    const query = `${artistName} DJ set techno`;
    const result = execSync(
      `yt-dlp --no-download --print "%(webpage_url)s|||%(title)s|||%(duration)s" ` +
        `--flat-playlist "ytsearch${maxResults}:${query}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 30000 }
    ).trim();

    return result
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [url, title, dur] = line.split("|||");
        return { url, title, duration: parseInt(dur) || 0 };
      })
      .filter((v) => v.duration > 60); // Skip very short videos
  } catch (err) {
    console.error(`  YouTube search failed for ${artistName}`);
    return [];
  }
}

/**
 * Download a segment of a YouTube video
 */
export function downloadClip(
  url: string,
  outputPath: string,
  startSec: number,
  durationSec: number
): boolean {
  try {
    // Download with yt-dlp, use ffmpeg to extract segment
    const tmpFile = outputPath.replace(".mp4", "_full.mp4");

    // Download section using yt-dlp's built-in section downloading
    execSync(
      `yt-dlp -f "bestvideo[height<=720]+bestaudio/best[height<=720]" ` +
        `--download-sections "*${startSec}-${startSec + durationSec}" ` +
        `--merge-output-format mp4 ` +
        `--no-playlist ` +
        `-o "${outputPath}" ` +
        `"${url}" 2>/dev/null`,
      { timeout: 120000 }
    );

    return existsSync(outputPath);
  } catch (err) {
    console.error(`  Download failed for ${url}`);
    return false;
  }
}

/**
 * Create a vertical (9:16) reel from multiple clips
 */
export function compileReel(
  clips: string[],
  outputPath: string,
  maxDurationSec = 60
): boolean {
  try {
    if (clips.length === 0) return false;

    // Calculate duration per clip
    const clipDuration = Math.floor(maxDurationSec / clips.length);

    // Build FFmpeg filter for concatenation + vertical crop
    const inputs = clips.map((c, i) => `-i "${c}"`).join(" ");
    const filterParts = clips
      .map(
        (_, i) =>
          `[${i}:v]trim=0:${clipDuration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[v${i}];` +
          `[${i}:a]atrim=0:${clipDuration},asetpts=PTS-STARTPTS,afade=t=out:st=${clipDuration - 1}:d=1[a${i}];`
      )
      .join("");

    const concatInputs = clips.map((_, i) => `[v${i}][a${i}]`).join("");

    execSync(
      `ffmpeg -y ${inputs} ` +
        `-filter_complex "${filterParts}${concatInputs}concat=n=${clips.length}:v=1:a=1[outv][outa]" ` +
        `-map "[outv]" -map "[outa]" ` +
        `-c:v libx264 -preset fast -crf 23 ` +
        `-c:a aac -b:a 128k ` +
        `"${outputPath}" 2>/dev/null`,
      { timeout: 180000 }
    );

    return existsSync(outputPath);
  } catch (err) {
    console.error(`  Reel compilation failed`);
    return false;
  }
}

/**
 * Generate a reel for an artist
 */
export async function generateArtistReel(
  artistName: string,
  artistSlug: string
): Promise<{ reelPath: string; clips: ClipInfo[] } | null> {
  console.log(`\n🎬 Generating reel for ${artistName}...`);

  const artistDir = path.join(VIDEOS_DIR, artistSlug);
  if (!existsSync(artistDir)) mkdirSync(artistDir, { recursive: true });

  // 1. Search YouTube
  const videos = searchYouTube(artistName);
  if (videos.length === 0) {
    console.log(`  ❌ No YouTube videos found`);
    return null;
  }
  console.log(`  📹 Found ${videos.length} videos`);

  // 2. Download clips (30sec from peak moments)
  const downloadedClips: ClipInfo[] = [];

  for (let i = 0; i < Math.min(videos.length, 3); i++) {
    const video = videos[i];
    const clipPath = path.join(artistDir, `clip_${i}.mp4`);

    // Take a segment from ~30% into the video (usually past the intro, into the good stuff)
    const startSec = Math.floor(video.duration * 0.3);
    const clipDuration = 20; // 20 seconds per clip

    console.log(
      `  ⬇️  Downloading clip ${i + 1}: "${video.title}" @ ${startSec}s`
    );
    const success = downloadClip(video.url, clipPath, startSec, clipDuration);

    if (success) {
      downloadedClips.push({
        sourceUrl: video.url,
        title: video.title,
        startSec,
        endSec: startSec + clipDuration,
        localPath: clipPath,
      });
    }
  }

  if (downloadedClips.length === 0) {
    console.log(`  ❌ No clips downloaded`);
    return null;
  }

  // 3. Compile reel
  const reelPath = path.join(REELS_DIR, `${artistSlug}-reel.mp4`);
  console.log(`  🎞️  Compiling reel from ${downloadedClips.length} clips...`);
  const compiled = compileReel(
    downloadedClips.map((c) => c.localPath),
    reelPath
  );

  if (compiled) {
    // Get file size
    const stats = execSync(`ls -lh "${reelPath}"`, { encoding: "utf-8" });
    console.log(`  ✅ Reel created: ${reelPath}`);
    console.log(`  📦 ${stats.trim().split(/\s+/)[4]}`);
    return { reelPath, clips: downloadedClips };
  }

  return null;
}

// --- Main: test with first CR artist ---
async function main() {
  const result = await generateArtistReel("Zombies In Miami", "zombies-in-miami");
  if (result) {
    console.log(`\n🏁 Reel ready!`);
    console.log(`Clips used:`, result.clips.map((c) => c.title));
  }
}

main().catch(console.error);
