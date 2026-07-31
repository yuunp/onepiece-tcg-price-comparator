import { NextResponse } from "next/server"
import { hasScraperApiKey } from "@/lib/runtime-config"
import { LigaOnePieceScraper } from "@/scripts/liga-scraper"

let globalScraper: LigaOnePieceScraper | null = null

async function getScraper(): Promise<LigaOnePieceScraper> {
  if (!globalScraper) {
    globalScraper = new LigaOnePieceScraper()
    await globalScraper.initialize()
  }
  return globalScraper
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  if (!hasScraperApiKey()) {
    return NextResponse.json({
      query,
      source: "ligaonepiece",
      totalFound: 0,
      results: [],
      available: false,
      warning: "SCRAPER_API_KEY is not configured",
    })
  }

  try {
    const scraper = await getScraper()
    const results = await scraper.searchCards(query)

    return NextResponse.json({
      query,
      source: "ligaonepiece",
      totalFound: results.length,
      results,
      available: true,
    })
  } catch (error) {
    console.error("Liga route error:", error)

    if (globalScraper) {
      await globalScraper.close().catch(() => undefined)
      globalScraper = null
    }

    return NextResponse.json({
      query,
      source: "ligaonepiece",
      totalFound: 0,
      results: [],
      available: false,
      warning: error instanceof Error ? error.message : "Liga search failed",
    })
  }
}

process.on("SIGTERM", async () => {
  if (globalScraper) {
    await globalScraper.close()
  }
})
