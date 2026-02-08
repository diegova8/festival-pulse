# 🎛️ Festival Pulse

A community-driven hub for techno & electronic music festival discovery.

## Vision

Automated pipeline that scrapes festival announcements, generates artist spotlight articles with video reels, and builds a community around electronic music events.

## MVP (Phase 1)

- Festival scraper (1-2x daily) pulling from RA, Shotgun, DICE, promoter socials
- Festival listings with lineup, dates, location, ticket links
- Basic Next.js site with SSR for SEO

## Phase 2

- Artist spotlight articles (AI-generated)
- Video reels compiled from YouTube clips (yt-dlp + FFmpeg)
- Auto-publish when new artists are announced

## Phase 3

- User accounts, "who's going", discussions
- Recommendations based on taste

## Phase 4

- Newsletter, social auto-posting, mobile app

## Tech Stack

- **Frontend:** Next.js (SSR)
- **Backend:** Next.js API routes / Node
- **Database:** PostgreSQL
- **Scraper:** Python (Scrapy/Playwright), cron scheduled
- **Video:** yt-dlp + FFmpeg pipeline
- **Content:** AI-generated articles
- **Auth:** NextAuth
- **Hosting:** Vercel + VPS for scraper/video jobs
