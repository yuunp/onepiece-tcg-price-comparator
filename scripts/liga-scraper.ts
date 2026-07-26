import * as cheerio from "cheerio"
import { SCRAPER_API_KEY, hasScraperApiKey } from "@/lib/runtime-config"

export interface LigaCard {
  name: string
  numericCode: string
  price: number
  currency: string
  imageUrl?: string
  url: string
  rarity?: string
  set?: string
  condition?: string
  seller?: string
  stock?: number
  priceLevel?: "cheap" | "medium" | "expensive"
  allPrices?: Array<{ value: number; type: string }>
}

export class LigaOnePieceScraper {
  async initialize() {
    return
  }

  async searchCards(query: string): Promise<LigaCard[]> {
    if (!hasScraperApiKey()) {
      return []
    }

    const targetUrl = `https://www.ligaonepiece.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(query)}&tipo=1`
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true&country_code=br&premium=true`

    try {
      const response = await fetch(scraperApiUrl, {
        next: { revalidate: 120 },
      })

      if (!response.ok) {
        throw new Error(`ScraperAPI error: ${response.status} ${response.statusText}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const results: LigaCard[] = []

      const extractPrice = (element: cheerio.Cheerio<any>): number => {
        const text = element.text()?.replace("R$", "").trim() || ""
        const cleanText = text.replace(/\./g, "").replace(",", ".")
        return Number.parseFloat(cleanText) || 0
      }

      const cardElements = $(".box.p25, .mtg-single, .card-item")

      cardElements.each((_, el) => {
        const element = $(el)
        const name = element.find(".mtg-name a").text().trim() || ""
        let numericCode = element.find(".mtg-numeric-code").text().trim() || ""

        if (numericCode.startsWith("(") && numericCode.endsWith(")")) {
          numericCode = numericCode.slice(1, -1).trim()
        }

        const prices = [
          { value: extractPrice(element.find(".price-min")), type: "min" },
          { value: extractPrice(element.find(".price-avg")), type: "avg" },
          { value: extractPrice(element.find(".price-max")), type: "max" },
        ].filter((price) => price.value > 0)

        const imgEl = element.find(".main-card")
        const imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || ""

        const linkEl = element.find(".main-link-card")
        let url = linkEl.attr("href") || ""
        if (url && !url.startsWith("http")) {
          url = `https://www.ligaonepiece.com.br${url}`
        }

        const set = element.find(".edition-name").text().trim() || ""

        if (name && prices.length > 0) {
          const minPrice = prices.find((price) => price.type === "min") || prices[0]
          results.push({
            name,
            numericCode,
            price: minPrice.value,
            currency: "BRL",
            imageUrl,
            url,
            rarity: "",
            set,
            condition: "NM",
            seller: "Liga One Piece",
            stock: 1,
            priceLevel: minPrice.type === "min" ? "cheap" : minPrice.type === "max" ? "expensive" : "medium",
            allPrices: prices,
          })
        }
      })

      return results.filter(
        (card, index, self) => index === self.findIndex((candidate) => candidate.name === card.name && candidate.numericCode === card.numericCode),
      )
    } catch (error) {
      console.error("Liga scraping error:", error)
      return []
    }
  }

  async close() {
    return
  }
}
