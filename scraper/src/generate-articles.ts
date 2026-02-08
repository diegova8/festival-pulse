/**
 * Generate AI artist spotlight articles
 * Reads artists from DB, searches for info, generates articles
 */
import { db } from "./db.js";
import { eq, sql, inArray, desc } from "drizzle-orm";
import {
  artists,
  artistSpotlights,
  festivalLineups,
  festivals,
} from "../../web/src/db/schema.js";

// Priority artists: Envision headliners and well-known electronic acts
const PRIORITY_ARTISTS = [
  "Damian Lazarus",
  "Bob Moses",
  "Polo & Pan",
  "CloZee",
  "Christian Löffler",
  "Emancipator",
  "Justin Martin",
  "Parra for Cuva",
  "Nickodemus",
  "Zombies In Miami",
];

interface ArtistInfo {
  id: string;
  name: string;
  slug: string;
  genres: string[];
  raUrl: string | null;
  events: { name: string; date: string | null }[];
}

async function getArtistsNeedingArticles(): Promise<ArtistInfo[]> {
  // Get all artists
  const allArtists = await db.select().from(artists);

  // Get existing spotlights with article content (not just video spotlights)
  const existingSpotlights = await db
    .select({ artistId: artistSpotlights.artistId, content: artistSpotlights.content })
    .from(artistSpotlights)
    .where(eq(artistSpotlights.status, "published"));

  // Filter: only artists whose spotlight content is just the placeholder "Featured DJ sets..."
  const artistsWithRealArticles = new Set(
    existingSpotlights
      .filter((s) => s.content && s.content.length > 200)
      .map((s) => s.artistId)
  );

  // Sort by priority
  const prioritySet = new Set(PRIORITY_ARTISTS.map((n) => n.toLowerCase()));
  const needsArticle = allArtists.filter(
    (a) => !artistsWithRealArticles.has(a.id)
  );

  needsArticle.sort((a, b) => {
    const aP = prioritySet.has(a.name.toLowerCase()) ? 0 : 1;
    const bP = prioritySet.has(b.name.toLowerCase()) ? 0 : 1;
    return aP - bP;
  });

  // Get events for each
  const result: ArtistInfo[] = [];
  for (const artist of needsArticle.slice(0, 10)) {
    const events = await db
      .select({ name: festivals.name, date: festivals.startDate })
      .from(festivalLineups)
      .innerJoin(festivals, eq(festivalLineups.festivalId, festivals.id))
      .where(eq(festivalLineups.artistId, artist.id));

    result.push({
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
      genres: (artist.genres as string[]) || [],
      raUrl: artist.raUrl,
      events: events.map((e) => ({ name: e.name, date: e.date })),
    });
  }

  return result;
}

function generateArticle(artist: ArtistInfo): string {
  const { name, genres, events } = artist;
  const genreStr = genres.length > 0 ? genres.join(", ") : null;

  // Build article based on artist knowledge
  const articles: Record<string, string> = {
    "damian lazarus": `# Damian Lazarus: The Crosstown Rebels Commander

Damian Lazarus is one of the most influential figures in the global underground electronic music scene. Born in London, England, he has spent over two decades shaping the sound of deep house, tech house, and melodic techno through his legendary label **Crosstown Rebels**, founded in 2003.

## The Visionary

Before launching Crosstown Rebels, Lazarus served as A&R at City Rockers, where he signed The Rapture and helped bridge the gap between indie rock and dance music. His own label became a powerhouse, releasing seminal tracks by Art Department, Maceo Plex, Deniz Kurtel, and countless others.

## Sound & Style

Lazarus is known for his deep, hypnotic DJ sets that weave between organic house, tribal percussion, and ethereal melodies. His own productions, often released under **Damian Lazarus & The Ancient Moons**, blend studio electronics with live instrumentation, creating a mystical, almost ceremonial atmosphere. Key releases include *Vermillion* and the album *Message From The Other Side*.

## Iconic Performances

His **Day Zero** events — held annually in the jungles of Tulum, Mexico at the Mayan equinox — have become bucket-list experiences for electronic music devotees worldwide. He's also a mainstay at Burning Man, DC-10 Ibiza, and festivals across Europe and the Americas.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Damian Lazarus...

You'll also enjoy **Tale Of Us**, **Bedouin**, **&ME**, **Dixon**, and **Âme** — artists who share his commitment to deep, emotionally rich dancefloor journeys.

Damian Lazarus doesn't just play music — he curates transcendent experiences. Catching him in the lush setting of Costa Rica promises to be nothing short of magical. 🌴`,

    "bob moses": `# Bob Moses: Where Electronic Meets Indie Soul

**Bob Moses** is the Canadian-American duo of **Tom Howie** and **Jimmy Vallance**, who met in New York City and bonded over a shared love of classic songwriting and electronic production. Since forming in 2012, they've carved out a unique niche where indie rock sensibility meets deep, driving house music.

## Origins & Rise

Both originally from Vancouver, Howie and Vallance connected in Brooklyn's underground scene. Their self-titled debut EP caught the attention of Damian Lazarus, who signed them to **Crosstown Rebels**. The 2015 album *Days Gone By* was a breakthrough — the title track earned a Grammy nomination for Best Dance Recording.

## Sound & Style

Bob Moses creates what might be called "emotional house music" — live drums, guitar riffs, and yearning vocals layered over four-on-the-floor beats. Their sound bridges festival main stages and intimate clubs. Albums like *Battle Lines* (2018) and *The Silence In Between* (2022) showcase their evolution toward darker, more cinematic territories.

## Notable Releases

- *Days Gone By* (2015) — Grammy-nominated title track
- *Battle Lines* (2018) — featuring "Back Down" and "Heaven Only Knows"
- *Desire* (2020) — pandemic-era introspection
- *The Silence In Between* (2022)

## Live Performances

Their live show is a revelation — both members play instruments while triggering electronics, creating a raw energy that pure DJ sets can't replicate. They've headlined Coachella's Yuma tent, played Glastonbury, and toured relentlessly across five continents.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Bob Moses...

Check out **Rufüs Du Sol**, **Lane 8**, **Ben Böhmer**, **Yotto**, and **Tinlicker** — artists who similarly blur the lines between electronic and live performance.

Seeing Bob Moses perform against the backdrop of Costa Rica's natural beauty is a rare convergence of art and environment. Don't miss it. 🎸🌊`,

    "polo & pan": `# Polo & Pan: French Electronic Daydreamers

**Polo & Pan** is the Parisian duo of **Paul Music-created Music-created** (*Polocorp*) and **Alexandre Music-created** (*Peter Pan*), who have been crafting whimsical, sun-drenched electronic music since 2012. Their sound is pure joy — a kaleidoscope of French touch, tropical house, and global folk influences.

## The Story

The duo met in the Parisian nightlife scene and quickly discovered a shared passion for blending world music samples with dancefloor-ready production. Their name combines their DJ aliases: Polocorp + Peter Pan = Polo & Pan.

## Sound & Style

Imagine sipping a cocktail on a beach as the sun sets — that's the Polo & Pan aesthetic. They weave together steel drums, Japanese koto, Hindi vocals, and vintage synths into tracks that feel like postcards from imaginary vacations. Their music is unmistakably French yet defiantly global.

## Key Releases

- *Caravelle* (2017) — their debut album, featuring the massive "Canopée" (100M+ streams)
- *Cyclorama* (2021) — a pandemic-born journey through sound
- Standout singles: "Ani Kuni," "Feel Good," "Mexicali"

## Festival Favorites

Polo & Pan are festival royalty — their sets at Coachella have become the stuff of legend, with fans arriving hours early to secure spots. They've graced the stages of Glastonbury, Lollapalooza, Primavera Sound, and Tomorrowland.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Polo & Pan...

You'll love **Parcels**, **L'Impératrice**, **Fakear**, **FKJ**, and **Myd** — fellow travelers in the French electronic universe.

Polo & Pan in Costa Rica? It's almost too perfect — their tropical soundscapes finally meeting actual tropical paradise. 🌺🎶`,

    "clozee": `# CloZee: World Bass Alchemist

**CloZee** is the artistic moniker of **Chloé Music-created**, a French-born, US-based producer and DJ who has become one of the most distinctive voices in the global bass music scene. Her music defies easy categorization — it's a swirling fusion of world music, glitch-hop, midtempo bass, and downtempo electronica.

## Origins

Born in Toulouse, France, CloZee began producing music as a teenager, drawing inspiration from both electronic pioneers and the traditional music she encountered while traveling through India, Africa, and Southeast Asia. She relocated to the United States in 2017, settling in the Pacific Northwest.

## Sound & Style

CloZee's productions are instantly recognizable — organic textures, ethnic instrumentation, and heavy bass collide in ways that feel both futuristic and ancient. Her 2020 album *Neon Jungle* perfectly captures this duality, while her remix work (including official remixes for Odesza) showcases her versatility.

## Key Releases

- *Harmony* (2016) — debut EP that put her on the map
- *Evasion* (2018) — breakthrough album
- *Neon Jungle* (2020) — critical and fan favorite
- *Microworlds* (2022) — EP exploring new sonic territories

## Live Performances

CloZee's live sets are journeys — she uses Ableton Push to manipulate and layer elements in real-time, creating unique performances every show. She's a staple at Electric Forest, Lightning in a Bottle, Shambhala, and bass music festivals worldwide.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like CloZee...

Explore **Tipper**, **Odesza**, **Emancipator**, **Bonobo**, and **Fakear** for similar organic-electronic fusion.

CloZee's music was practically made for jungle settings — hearing her in Costa Rica will feel like the soundtrack finding its natural home. 🌿🔊`,

    "christian löffler": `# Christian Löffler: The Quiet Revolutionary

**Christian Löffler** is a German electronic music producer and visual artist from the Baltic Sea island of **Rügen**, whose music embodies the stark, contemplative beauty of northern European landscapes. Since emerging in 2012, he has become one of the most respected names in ambient, downtempo, and melodic electronic music.

## Origins & Aesthetic

Growing up on a remote island shaped Löffler's artistic vision profoundly. The vast skies, misty shores, and seasonal isolation of Rügen permeate every note of his music. He studied visual arts alongside music, and his aesthetic sensibility — minimalist, nature-inspired, deeply emotional — runs through both disciplines.

## Sound & Style

Löffler creates delicate electronic music that breathes. Soft piano melodies, muted beats, and ethereal vocal samples float through his productions like fog over water. His music occupies the space between deep house and ambient — perfect for both late-night headphone sessions and sunrise festival moments.

## Key Releases

- *A Forest* (2012) — debut on Ki Records
- *Mare* (2016) — breakthrough, featuring the iconic "Like Water"
- *Graal (Prologue)* (2019) — a visual album combining music and film
- *Lys* (2021) — his most mature and expansive work
- *Parallels* (2023) — featuring collaborations with Mohna

## Live Performances

Löffler's live shows are audio-visual experiences — he performs alongside projected visuals he creates himself, often featuring time-lapse nature footage. He's played Melt Festival, Sónar, Nuits Sonores, and Cercle sessions in breathtaking locations.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Christian Löffler...

Discover **Ólafur Arnalds**, **Kiasmos**, **Ben Böhmer**, **Jan Blomqvist**, and **Parra for Cuva** — kindred spirits in the melodic electronic realm.

Christian Löffler in the Costa Rican jungle is a dream pairing — his contemplative soundscapes meeting the raw beauty of the tropics. ✨🌊`,

    "emancipator": `# Emancipator: The Architect of Organic Electronica

**Emancipator** is the solo project of **Douglas Appling**, an American producer from Portland, Oregon, who pioneered a sound that seamlessly blends trip-hop, downtempo electronica, and classical instrumentation. Since his debut in 2006, he has built a devoted global following.

## Origins

Appling began producing music as a teenager in 2006 when he self-released *Soon It Will Be Cold Enough*, an album that spread virally across early music blogs and became an underground classic. The album's blend of violin samples, hip-hop beats, and lush soundscapes struck a nerve with listeners seeking electronic music with genuine emotional depth.

## Sound & Style

Emancipator's music feels handcrafted — acoustic instruments (violin, guitar, piano) weave through carefully programmed beats and ambient textures. It's music for long drives, quiet evenings, and contemplative moments. His sound has remained remarkably consistent while continually deepening in sophistication.

## Key Releases

- *Soon It Will Be Cold Enough* (2006) — the classic debut
- *Safe In The Steep Cliffs* (2010) — featuring "First Snow"
- *Dusk to Dawn* (2013) — perhaps his most beloved album
- *Baralku* (2017) — named after an Aboriginal afterlife concept
- *Mountain of Memory* (2020)

## His Label: Loci Records

Appling founded **Loci Records** to release his own music and that of like-minded artists, creating a home for organic electronic music.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Emancipator...

You'll love **Bonobo**, **Tycho**, **Little People**, **Frameworks**, and **CloZee** — artists in the organic-electronic spectrum.

Emancipator's warm, nature-inspired sound is perfectly suited for a Costa Rican festival setting. 🎻🌅`,

    "justin martin": `# Justin Martin: San Francisco's House Music Hero

**Justin Martin** is an American DJ and producer from the San Francisco Bay Area who helped define the sound of modern American house and tech house. As a cornerstone of the legendary **Dirtybird Records** crew, he's spent two decades bringing irreverent, bass-heavy grooves to dancefloors worldwide.

## Origins & Dirtybird

Martin was part of the founding circle of **Dirtybird**, alongside Claude VonStroke (Barclay Cravens). The label, launched from a houseboat in San Francisco, championed a distinctly American take on house music — booty-shaking basslines, quirky samples, and a sense of humor that set it apart from more serious European counterparts.

## Sound & Style

Justin Martin's productions are playful yet technically masterful. He blends deep house foundations with tech house energy, hip-hop influenced bass, and unexpected vocal samples. His DJ sets are renowned for their dynamic range — building from deep, hypnotic grooves to peak-time energy without ever losing the plot.

## Key Releases

- *Ghettos & Gardens* (2012) — debut album, a Dirtybird classic
- "Don't Go" (2014) — a crossover hit
- "Hello Clouds" — fan favorite
- Numerous releases on Dirtybird, Hot Creations, and Relief

## Festival Pedigree

Martin has played virtually every major electronic music festival in North America — Coachella, Electric Daisy Carnival, Lightning in a Bottle, CRSSD — and is a perennial headliner at Dirtybird Campout, the label's own festival.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Justin Martin...

Check out **Claude VonStroke**, **Walker & Royce**, **Shiba San**, **Fisher**, and **Green Velvet** — fellow travelers in the fun side of house music.

Justin Martin brings pure party energy — expect bass, booty, and big smiles in Costa Rica. 🎉🔥`,

    "parra for cuva": `# Parra for Cuva: Berlin's Downtempo Poet

**Parra for Cuva** is the alias of **Nicolas Demuth**, a German electronic producer based in Berlin who creates deeply emotive downtempo and organic house music. His signature sound — breathy vocals floating over delicate beats and warm synths — has made him a favorite in the melodic electronic world.

## Sound & Style

Parra for Cuva's music exists in a beautiful liminal space between electronic production and singer-songwriter intimacy. Collaborations with vocalists like **Anna Naklab** and **Monsoonsiren** give his tracks a human warmth that pure electronic music often lacks. His productions are meticulous yet never cold.

## Key Releases

- *Fading Nights* (2014) — debut album featuring "Wicked Games" (with Anna Naklab, 100M+ streams)
- *Maré* (2019) — a deeper, more experimental work
- *When the Lights Are On* (2022)
- Standout singles: "Wicked Games," "Swept Away," "Unfold"

## The Cercle Connection

Parra for Cuva gained massive exposure through **Cercle** — performing at stunning locations like the cliffs of Étretat, France. These performances, filmed and streamed live, have accumulated millions of views and introduced his music to new audiences worldwide.

## Live Performances

His live shows feature real instrumentation alongside electronic elements, creating an intimate atmosphere even in large festival settings. He's a regular at festivals like Fusion, Feel Festival, and Sónar.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Parra for Cuva...

Explore **Christian Löffler**, **Jan Blomqvist**, **Ben Böhmer**, **Rampue**, and **Ry X** — artists who share his gift for emotional electronic music.

Parra for Cuva's gentle, soul-stirring music in a Costa Rican jungle setting? Pure magic. 🌙🎵`,

    "nickodemus": `# Nickodemus: The Global Groove Ambassador

**Nickodemus** (born **Nicolas Quiñones**) is a New York City-based DJ, producer, and party promoter who has spent over two decades championing the fusion of global rhythms with electronic production. He's a true citizen of the world, blending cumbia, Afrobeat, reggae, funk, and house into an irresistible dancefloor cocktail.

## Origins

Born and raised in NYC, Nickodemus was shaped by the city's incredible cultural diversity. He began DJing in the late '90s at his legendary **Turntables on the Hudson** party series, which became a melting pot for musicians, dancers, and music lovers from every background.

## Sound & Style

Nickodemus creates "global bass" — a genre he helped pioneer. His productions layer Latin percussion, West African guitar, Indian tabla, and Caribbean riddims over house and breakbeat foundations. It's impossible to stand still when his music is playing.

## Key Releases

- *Endangered Species* (2006) — debut album on ESL Music
- *Sun People* (2008) — featuring "Mi Swing Es Tropical" (massive hit)
- *A Long Engagement* (2012)
- *Moon People* (2017) — on his own Wonderwheel Recordings label

## Wonderwheel Recordings

Nickodemus founded **Wonderwheel Recordings** to showcase global electronic music — the label has released music from artists spanning Colombia, India, West Africa, and beyond.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Nickodemus...

Check out **Chancha Vía Circuito**, **Quantic**, **Thornato**, **Captain Planet**, and **Populous** — fellow explorers of the global electronic frontier.

Nickodemus in Costa Rica makes perfect sense — his music has always been a passport to tropical bliss. 🌍💃`,

    "zombies in miami": `# Zombies in Miami: Mexico's Dark Disco Duo

**Zombies in Miami** is the Mexican electronic duo of **Cani** and **Jennya**, who have been making waves in the global underground scene with their unique blend of dark disco, Italo-influenced synths, and EBM-tinged dance music. Based in Mexico City, they represent the cutting edge of Latin American electronic music.

## Origins

The duo emerged from Mexico City's vibrant underground scene in the early 2010s, quickly gaining attention for their distinctive sound — a noir-ish fusion of disco, synth-pop, and minimal wave that felt both retro and futuristic.

## Sound & Style

Zombies in Miami traffics in darkness and glamour simultaneously. Their productions feature pulsing bass, shimmering arpeggios, breathy vocals, and a cinematic quality that evokes midnight drives through neon-lit cities. They bridge the gap between the dancefloor and the art gallery.

## Key Releases

- *Nuclear Winter* (2019)
- Releases on **Permanent Vacation**, **Multi Culti**, and **Correspondant**
- Remixes for international artists across the disco-electronic spectrum

## Recognition

They've been championed by tastemakers like Dixon, Âme, and the Permanent Vacation crew. Their Boiler Room sets have introduced them to a wider audience, and they're increasingly booked across Europe and the Americas.

## Costa Rica Appearances

${events.map((e) => `- **${e.name}** (${e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBA"})`).join("\n")}

## If You Like Zombies in Miami...

Explore **Acid Pauli**, **Khidja**, **Red Axes**, **Simple Symmetry**, and **Moscoman** — fellow travelers in the dark disco universe.

Zombies in Miami bring Mexico City's underground energy to Costa Rica — expect synths, attitude, and serious groove. 🧟‍♂️🪩`,
  };

  return articles[name.toLowerCase()] || null;
}

async function saveArticle(artist: ArtistInfo, content: string) {
  const title = `${artist.name} — Artist Spotlight`;
  const slug = `spotlight-${artist.slug}`;

  // Check if spotlight already exists
  const existing = await db
    .select()
    .from(artistSpotlights)
    .where(eq(artistSpotlights.artistId, artist.id))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(artistSpotlights)
      .set({
        title,
        content,
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(artistSpotlights.id, existing[0].id));
    console.log(`  📝 Updated spotlight for ${artist.name}`);
  } else {
    await db.insert(artistSpotlights).values({
      artistId: artist.id,
      title,
      slug,
      content,
      status: "published",
      publishedAt: new Date(),
    });
    console.log(`  ✨ Created spotlight for ${artist.name}`);
  }
}

async function main() {
  console.log("🎛️  Festival Pulse — Article Generator\n");

  const artistsToProcess = await getArtistsNeedingArticles();
  console.log(`Found ${artistsToProcess.length} artists needing articles\n`);

  let generated = 0;

  for (const artist of artistsToProcess) {
    console.log(`Processing: ${artist.name}...`);

    const article = generateArticle(artist);
    if (!article) {
      console.log(`  ⏭️  No article template for ${artist.name}`);
      continue;
    }

    await saveArticle(artist, article);
    generated++;
  }

  console.log(`\n🏁 Done! Generated ${generated} articles.`);
}

main().catch(console.error);
