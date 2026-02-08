/**
 * Resident Advisor GraphQL client
 * Fetches events/festivals from ra.co/graphql
 */

const RA_GRAPHQL = "https://ra.co/graphql";

const HEADERS = {
  "Content-Type": "application/json",
  Referer: "https://ra.co/events",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const EVENT_LISTINGS_QUERY = `
  query GET_EVENT_LISTINGS(
    $filters: FilterInputDtoInput
    $pageSize: Int
    $page: Int
  ) {
    eventListings(
      filters: $filters
      pageSize: $pageSize
      page: $page
      sort: { attending: { priority: 1, order: DESCENDING } }
    ) {
      data {
        id
        listingDate
        event {
          id
          title
          date
          startTime
          endTime
          contentUrl
          attending
          images {
            filename
          }
          venue {
            id
            name
            area {
              id
              name
              country {
                id
                name
              }
            }
            address
          }
          artists {
            id
            name
          }
          __typename
        }
        __typename
      }
      totalResults
      __typename
    }
  }
`;

export interface RAEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  contentUrl: string;
  attending: number;
  images: { filename: string }[];
  venue: {
    id: string;
    name: string;
    address: string;
    area: {
      id: string;
      name: string;
      country: { id: string; name: string };
    };
  };
  artists: { id: string; name: string }[];
}

export interface RAEventListing {
  id: string;
  listingDate: string;
  event: RAEvent;
}

interface RAResponse {
  data: {
    eventListings: {
      data: RAEventListing[];
      totalResults: number;
    };
  };
}

export async function fetchRAEvents(
  areaId: number,
  dateGte: string,
  dateLte: string,
  pageSize = 20
): Promise<RAEventListing[]> {
  const allEvents: RAEventListing[] = [];
  let page = 1;

  while (true) {
    const payload = {
      query: EVENT_LISTINGS_QUERY,
      variables: {
        filters: {
          areas: { eq: areaId },
          listingDate: {
            gte: `${dateGte}T00:00:00.000Z`,
            lte: `${dateLte}T23:59:59.999Z`,
          },
        },
        pageSize,
        page,
      },
    };

    const res = await fetch(RA_GRAPHQL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`RA API error: ${res.status} ${res.statusText}`);
      break;
    }

    const json = (await res.json()) as RAResponse;
    const listings = json.data?.eventListings?.data;

    if (!listings || listings.length === 0) break;

    allEvents.push(...listings);
    console.log(`  Page ${page}: ${listings.length} events (total: ${allEvents.length})`);

    if (allEvents.length >= json.data.eventListings.totalResults) break;

    page++;
    // Rate limiting - be respectful
    await new Promise((r) => setTimeout(r, 1500));
  }

  return allEvents;
}

// RA Area codes for major techno cities
export const RA_AREAS = {
  berlin: 34,
  london: 13,
  amsterdam: 29,
  barcelona: 8,
  detroit: 43,
  "new-york": 8,
  ibiza: 25,
  paris: 44,
  "los-angeles": 23,
  miami: 28,
} as const;
