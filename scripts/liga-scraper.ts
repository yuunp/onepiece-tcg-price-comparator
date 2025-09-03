import { chromium, type Browser, type Page } from "playwright"

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
  allPrices?: Array<{value: number, type: string}>
}

export class LigaOnePieceScraper {
  private browser: Browser | null = null
  private page: Page | null = null
  private isInitializing: boolean = false
  private isClosing: boolean = false

  async initialize() {
    if (this.isInitializing) {
      console.log("⏳ Scraper já está inicializando...")
      return
    }
    this.isInitializing = true
    
    try {
      console.log("🔧 Inicializando browser headless...")
      
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      })
      
      console.log("✅ Browser launched")
      
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        }
      })

      // ✅ Remover detecção de automation
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })

      this.page = await context.newPage()
      console.log("✅ Page created")
      
      this.isInitializing = false
      console.log("✅ Scraper inicializado com sucesso")
      
    } catch (error) {
      this.isInitializing = false
      console.error("❌ Falha na inicialização:", error)
      throw error
    }
  }

  async searchCards(query: string): Promise<LigaCard[]> {
    // ✅ VERIFICAÇÃO ROBUSTA
    if (!this.page || !this.browser) {
      console.log("❌ Scraper não está inicializado")
      throw new Error("Scraper not initialized")
    }

    if (this.page.isClosed()) {
      console.log("❌ Página foi fechada")
      throw new Error("Page has been closed")
    }

    try {
      console.log(`🔍 Buscando: "${query}"`)
      const searchUrl = `https://www.ligaonepiece.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(query)}&tipo=1`
      
      console.log(`📍 Navegando para: ${searchUrl}`)
      
      // ✅ NAVEGAÇÃO SIMPLES E CONFIÁVEL
      await this.page.goto(searchUrl, {
        waitUntil: 'load',
        timeout: 30000
      })

      // ✅ ESPERA PARA CARREGAMENTO COMPLETO
      await this.page.waitForTimeout(5000)

      // ✅ VERIFICAR SE CARREGOU CORRETAMENTE
      const pageTitle = await this.page.title()
      console.log(`📄 Página carregada: ${pageTitle}`)

      // ✅ EXTRAIR DADOS
      const cards = await this.page.evaluate(() => {
        const results: any[] = []
        
        const extractPrice = (element: Element | null): number => {
          if (!element) return 0
          const text = element.textContent?.replace('R$', '').trim() || ''
          const cleanText = text.replace(/\./g, '').replace(',', '.')
          return parseFloat(cleanText) || 0
        }

        const cardElements = document.querySelectorAll('.box.p25, .mtg-single, .card-item')
        console.log(`📊 Encontrados ${cardElements.length} elementos de carta`)

        cardElements.forEach((element) => {
          try {
            const name = element.querySelector('.mtg-name a')?.textContent?.trim() || ""
            let numericCode = element.querySelector('.mtg-numeric-code')?.textContent?.trim() || ""
            
            if (numericCode.startsWith('(') && numericCode.endsWith(')')) {
              numericCode = numericCode.slice(1, -1).trim()
            }

            const prices = [
              { value: extractPrice(element.querySelector('.price-min')), type: 'min' },
              { value: extractPrice(element.querySelector('.price-avg')), type: 'avg' },
              { value: extractPrice(element.querySelector('.price-max')), type: 'max' }
            ].filter(p => p.value > 0)

            const imgEl = element.querySelector('.main-card') as HTMLImageElement
            const imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || ''

            const linkEl = element.querySelector('.main-link-card') as HTMLAnchorElement
            let url = linkEl?.href || ''
            if (url && !url.startsWith('http')) {
              url = `https://www.ligaonepiece.com.br${url}`
            }

            const set = element.querySelector('.edition-name')?.textContent?.trim() || ""

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
            console.error("Erro extraindo dados:", e)
          }
        })

        return results.filter((card, index, self) =>
          index === self.findIndex(c => c.name === card.name && c.numericCode === card.numericCode)
        )
      })

      console.log(`✅ Encontradas ${cards.length} cartas para "${query}"`)
      return cards

    } catch (error) {
      console.error("❌ Erro no scraping:", error)
      
      // ✅ TENTAR RECRIAR A PÁGINA SE FECHADA
      if (this.page.isClosed() && this.browser && !this.isClosing) {
        console.log("🔄 Página fechada, tentando recriar...")
        try {
          const context = await this.browser.newContext()
          this.page = await context.newPage()
          return await this.searchCards(query) // Retry
        } catch (retryError) {
          console.error("❌ Falha ao recriar página:", retryError)
        }
      }
      
      return []
    }
  }

  async close() {
    if (this.isClosing) return
    this.isClosing = true
    
    try {
      console.log("🔒 Fechando scraper...")
      
      if (this.page && !this.page.isClosed()) {
        await this.page.close()
        console.log("✅ Página fechada")
      }
      
      if (this.browser) {
        await this.browser.close()
        console.log("✅ Browser fechado")
      }
      
      this.page = null
      this.browser = null
      console.log("✅ Scraper fechado com sucesso")
      
    } catch (error) {
      console.error("❌ Erro ao fechar scraper:", error)
    } finally {
      this.isClosing = false
    }
  }

  async inspectPage() {
    if (!this.page || this.page.isClosed()) {
      console.log("❌ Página não disponível para inspeção")
      return ""
    }
    
    const html = await this.page.content()
    console.log("📄 Page HTML length:", html.length)
    return html
  }
}

// ✅ Função de teste para verificar se está funcionando
export async function testScraper() {
  const scraper = new LigaOnePieceScraper()

  try {
    console.log("🧪 Testando scraper...")
    await scraper.initialize()
    
    const results = await scraper.searchCards("luffy")
    
    console.log(`\n📋 Resultados do teste: ${results.length} cartas encontradas`)
    
    if (results.length === 0) {
      console.log("❌ Nenhum resultado encontrado")
      await scraper.inspectPage()
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

// ✅ Função de comparação de preços
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