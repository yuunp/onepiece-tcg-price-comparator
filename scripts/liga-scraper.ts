import * as cheerio from "cheerio"

const SCRAPER_API_KEY = "d9ae58b0d53de2809c283d035321f3c9"

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
  priceLevel?: 'cheap' | 'medium' | 'expensive'
  allPrices?: Array<{ value: number, type: string }>
}

export class LigaOnePieceScraper {
  async initialize() {
    console.log("✅ Scraper API wrapper initialized")
  }

  async searchCards(query: string): Promise<LigaCard[]> {
    console.log(`🔍 Buscando: "${query}" via ScraperAPI`)
    const targetUrl = `https://www.ligaonepiece.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(query)}&tipo=1`

    // We add render=true because Liga One Piece uses JS to display card prices & results
    // We add country_code=br and premium=true to rotate high quality residential IP proxies to bypass Cloudflare
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true&country_code=br&premium=true`

    try {
      console.log(`📍 Fazendo requisicao para ScraperAPI...`)
      const response = await fetch(scraperApiUrl)

      if (!response.ok) {
        throw new Error(`ScraperAPI error: ${response.status} ${response.statusText}`)
      }

      const html = await response.text()
      console.log(`📄 Resposta recebida, tamanho: ${html.length}`)

      const $ = cheerio.load(html)
      const results: LigaCard[] = []

      const extractPrice = (element: any): number => {
        const text = element.text()?.replace('R$', '').trim() || ''
        const cleanText = text.replace(/\./g, '').replace(',', '.')
        return parseFloat(cleanText) || 0
      }

      const cardElements = $('.box.p25, .mtg-single, .card-item')
      console.log(`📊 Encontrados ${cardElements.length} elementos de carta HTML`)

      cardElements.each((_, el) => {
        try {
          const element = $(el)
          const name = element.find('.mtg-name a').text().trim() || ""
          let numericCode = element.find('.mtg-numeric-code').text().trim() || ""

          if (numericCode.startsWith('(') && numericCode.endsWith(')')) {
            numericCode = numericCode.slice(1, -1).trim()
          }

          const prices = [
            { value: extractPrice(element.find('.price-min')), type: 'min' },
            { value: extractPrice(element.find('.price-avg')), type: 'avg' },
            { value: extractPrice(element.find('.price-max')), type: 'max' }
          ].filter(p => p.value > 0)

          const imgEl = element.find('.main-card')
          const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || ''

          const linkEl = element.find('.main-link-card')
          let url = linkEl.attr('href') || ''
          if (url && !url.startsWith('http')) {
            url = `https://www.ligaonepiece.com.br${url}`
          }

          const set = element.find('.edition-name').text().trim() || ""

          if (name && prices.length > 0) {
            const minPrice = prices.find(p => p.type === 'min') || prices[0]
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
              priceLevel: minPrice.type === 'min' ? 'cheap' : minPrice.type === 'max' ? 'expensive' : 'medium',
              allPrices: prices
            })
          }
        } catch (e) {
          console.error("Erro extraindo dados de um card:", e)
        }
      })

      // Remove duplicates
      const uniqueResults = results.filter((card, index, self) =>
        index === self.findIndex(c => c.name === card.name && c.numericCode === card.numericCode)
      )

      console.log(`✅ Extraidas e retornadas ${uniqueResults.length} cartas para "${query}"`)
      return uniqueResults

    } catch (error) {
      console.error("❌ Erro no scraping com API:", error)
      return []
    }
  }

  async close() {
    console.log("✅ Scraper fechado com sucesso")
  }
}

export async function testScraper() {
  const scraper = new LigaOnePieceScraper()

  try {
    console.log("🧪 Testando scraper com ScraperAPI...")
    await scraper.initialize()

    const results = await scraper.searchCards("luffy")

    console.log(`\n📋 Resultados do teste: ${results.length} cartas encontradas`)

    if (results.length === 0) {
      console.log("❌ Nenhum resultado encontrado")
    } else {
      results.forEach((card, i) => {
        console.log(`\n${i + 1}. ${card.name} ${card.numericCode}`)
        console.log(`   💰 Preço: R$${card.price}`)
        console.log(`   🖼️  Imagem: ${card.imageUrl ? 'Sim' : 'Não'}`)
        console.log(`   🔗 Link: ${card.url ? 'Sim' : 'Não'}`)
      })
    }

    return results

  } catch (error) {
    console.error("❌ Erro no teste:", error)
    return []
  } finally {
    await scraper.close()
    console.log("🏁 Teste finalizado")
  }
}

export function compareCardPrices(tcgCard: any, ligaCard: LigaCard) {
  const comparison = {
    cardName: `${ligaCard.name} ${ligaCard.numericCode}`,
    tcgPrice: tcgCard.price || 0,
    ligaPrice: ligaCard.price,
    ligaPriceLevel: ligaCard.priceLevel,
    currency: ligaCard.currency,
    difference: (ligaCard.price - (tcgCard.price || 0)),
    percentageDiff: tcgCard.price ?
      ((ligaCard.price - tcgCard.price) / tcgCard.price * 100).toFixed(2) + '%' :
      'N/A',
    bestDeal: ligaCard.price < (tcgCard.price || Infinity) ? 'Liga One Piece' : 'TCGPlayer',
    ligaAdvantage: ligaCard.priceLevel === 'cheap' ? 'Preço promocional (verde)' : null
  }

  return comparison
}