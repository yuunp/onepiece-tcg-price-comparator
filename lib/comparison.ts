import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"

export type BestPrice = "tcg" | "liga" | "tie"
export type MatchType = "perfect" | "high" | "medium" | "none"

export interface CardVariation {
  code: string
  name: string
  description: string
  rarity?: string
  emoji: string
}

export interface CardMatch {
  tcgCard?: TCGPlayerCard
  ligaCard?: LigaCard
  similarity: number
  bestPrice: BestPrice
  savings?: number
  matchType: MatchType
  matchMethod?: string
  confidenceScore: number
  matchReasons: string[]
}

interface SimilarityAnalysis {
  score: number
  reasons: string[]
  method: string
}

const DEFAULT_EXCHANGE_RATE = 0.19

export const identifyVariation = (numericCode: string): CardVariation => {
  const variations: Record<string, CardVariation> = {
    E: { code: "E", name: "Special", description: "Edição especial", rarity: "Special", emoji: "⭐" },
    AA: { code: "AA", name: "Alternate Art", description: "Arte alternativa", rarity: "Super Rare", emoji: "🎨" },
    RE: { code: "RE", name: "Reprint", description: "Reimpressão", rarity: "Common", emoji: "🔄" },
    FA: { code: "FA", name: "Full Art", description: "Arte completa", rarity: "Rare", emoji: "🖼️" },
    AS: { code: "AS", name: "Anniversary Set", description: "Edição de aniversário", rarity: "Secret Rare", emoji: "🎂" },
    BS: { code: "BS", name: "Best Selection", description: "Seleção especial", rarity: "Super Rare", emoji: "🏆" },
    CH: { code: "CH", name: "Championship", description: "Edição de campeonato", rarity: "Promo", emoji: "🥇" },
    PR: { code: "PR", name: "Promo", description: "Cartão promocional", rarity: "Promo", emoji: "🎁" },
    SP: { code: "SP", name: "Special", description: "Edição especial", rarity: "Special", emoji: "✨" },
    SR: { code: "SR", name: "Super Rare", description: "Super rara", rarity: "Super Rare", emoji: "💎" },
  }

  const suffix = numericCode.split("-").pop()?.replace(/^\d+/, "") || ""

  return (
    variations[suffix] || {
      code: suffix,
      name: "Standard",
      description: "Versão padrão",
      rarity: "Normal",
      emoji: "📄",
    }
  )
}

export const convertUsdToBrl = (usdPrice: number, exchangeRate: number = DEFAULT_EXCHANGE_RATE): number => {
  return usdPrice / exchangeRate
}

export const matchCards = (
  tcgCards: TCGPlayerCard[],
  ligaCards: LigaCard[],
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
): CardMatch[] => {
  const matches: CardMatch[] = []
  const usedLigaIndices = new Set<number>()
  const usedTcgIndices = new Set<number>()

  tcgCards.forEach((tcgCard, tcgIndex) => {
    let bestMatch: { index: number; score: number; analysis: SimilarityAnalysis } = {
      index: -1,
      score: 0,
      analysis: { score: 0, reasons: [], method: "" },
    }

    ligaCards.forEach((ligaCard, ligaIndex) => {
      if (usedLigaIndices.has(ligaIndex)) return
      const analysis = calculateSimilarity(tcgCard, ligaCard)
      if (analysis.score > bestMatch.score && analysis.score >= 0.8) {
        bestMatch = { index: ligaIndex, score: analysis.score, analysis }
      }
    })

    if (bestMatch.index !== -1) {
      usedLigaIndices.add(bestMatch.index)
      usedTcgIndices.add(tcgIndex)
      matches.push(createCardMatch(tcgCard, ligaCards[bestMatch.index], bestMatch.analysis, exchangeRate))
    }
  })

  tcgCards.forEach((tcgCard, tcgIndex) => {
    if (usedTcgIndices.has(tcgIndex)) return

    let bestMatch: { index: number; score: number; analysis: SimilarityAnalysis } = {
      index: -1,
      score: 0,
      analysis: { score: 0, reasons: [], method: "" },
    }

    ligaCards.forEach((ligaCard, ligaIndex) => {
      if (usedLigaIndices.has(ligaIndex)) return
      const analysis = calculateSimilarity(tcgCard, ligaCard)
      if (analysis.score > bestMatch.score && analysis.score >= 0.6) {
        bestMatch = { index: ligaIndex, score: analysis.score, analysis }
      }
    })

    if (bestMatch.index !== -1) {
      usedLigaIndices.add(bestMatch.index)
      usedTcgIndices.add(tcgIndex)
      matches.push(createCardMatch(tcgCard, ligaCards[bestMatch.index], bestMatch.analysis, exchangeRate))
    }
  })

  tcgCards.forEach((card, index) => {
    if (!usedTcgIndices.has(index)) {
      matches.push({
        tcgCard: card,
        similarity: 0,
        bestPrice: "tcg",
        matchType: "none",
        matchMethod: "No match found",
        confidenceScore: 0,
        matchReasons: ["No match found"],
      })
    }
  })

  ligaCards.forEach((card, index) => {
    if (!usedLigaIndices.has(index)) {
      matches.push({
        ligaCard: card,
        similarity: 0,
        bestPrice: "liga",
        matchType: "none",
        matchMethod: "No match found",
        confidenceScore: 0,
        matchReasons: ["No match found"],
      })
    }
  })

  return matches
}

const calculateSimilarity = (tcgCard: TCGPlayerCard, ligaCard: LigaCard): SimilarityAnalysis => {
  const reasons: string[] = []
  let totalScore = 0

  const tcgSetName = tcgCard.groupName?.toLowerCase().trim()
  const ligaSetName = ligaCard.set?.toLowerCase().trim()

  if (tcgSetName && ligaSetName && tcgSetName === ligaSetName) {
    totalScore += 30
    reasons.push(`Same set: "${tcgSetName}" (30%)`)
  }

  const tcgNameNormalized = normalizeName(tcgCard.name)
  const ligaNameNormalized = normalizeName(ligaCard.name)

  if (tcgNameNormalized && ligaNameNormalized) {
    if (tcgNameNormalized === ligaNameNormalized) {
      totalScore += 40
      reasons.push(`Identical name: "${tcgNameNormalized}" (40%)`)
    } else if (
      tcgNameNormalized.includes(ligaNameNormalized) ||
      ligaNameNormalized.includes(tcgNameNormalized)
    ) {
      totalScore += 25
      reasons.push(`Names similar: "${tcgNameNormalized}" ~ "${ligaNameNormalized}" (25%)`)
    }
  }

  const tcgCode = tcgCard.extendedData?.find((detail) => detail.name === "Number")?.value || extractCardNumber(tcgCard.name)
  const ligaCode = ligaCard.numericCode

  if (tcgCode && ligaCode) {
    const tcgBase = normalizeCode(tcgCode)
    const ligaBase = normalizeCode(ligaCode)

    if (tcgBase === ligaBase) {
      totalScore += 30
      reasons.push(`Base code: ${tcgBase} (30%)`)
    } else {
      const tcgSetFromCode = tcgCode.split("-")[0]
      const ligaSetFromCode = ligaCode.split("-")[0]
      if (tcgSetFromCode === ligaSetFromCode) {
        totalScore += 15
        reasons.push(`Same set in code: ${tcgSetFromCode} (15%)`)
      }
    }
  }

  const finalScore = Math.min(totalScore / 100, 1)

  let method = "Basic Matching"
  if (finalScore >= 0.9) method = "Perfect Match"
  else if (finalScore >= 0.7) method = "Good Match"
  else if (finalScore >= 0.5) method = "Partial Match"

  return { score: finalScore, reasons, method }
}

const createCardMatch = (
  tcgCard: TCGPlayerCard,
  ligaCard: LigaCard,
  analysis: SimilarityAnalysis,
  exchangeRate: number,
): CardMatch => {
  const tcgPrice = tcgCard.price?.marketPrice || 0
  const ligaPriceUsd = ligaCard.price * exchangeRate

  let bestPrice: BestPrice = "tie"
  let savings = 0

  if (tcgPrice < ligaPriceUsd) {
    bestPrice = "tcg"
    savings = ligaPriceUsd - tcgPrice
  } else if (tcgPrice > ligaPriceUsd) {
    bestPrice = "liga"
    savings = tcgPrice - ligaPriceUsd
  }

  let matchType: MatchType = "none"
  if (analysis.score >= 0.9) matchType = "perfect"
  else if (analysis.score >= 0.7) matchType = "high"
  else if (analysis.score >= 0.5) matchType = "medium"

  return {
    tcgCard,
    ligaCard,
    similarity: analysis.score,
    bestPrice,
    savings,
    matchType,
    matchMethod: analysis.method,
    confidenceScore: Math.round(analysis.score * 100),
    matchReasons: analysis.reasons,
  }
}

const extractCardNumber = (name: string): string | null => {
  if (!name) return null

  const patterns = [
    /(OP\d{2}-\d{3}[A-Z]*)/i,
    /(ST\d{2}-\d{3}[A-Z]*)/i,
    /(EB\d{2}-\d{3}[A-Z]*)/i,
    /(PRB\d{2}-\d{3}[A-Z]*)/i,
    /(P-\d{3}[A-Z]*)/i,
    /([A-Z]{2,4}\d{1,2}-\d{3}[A-Z]*)/i,
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) return match[1].toUpperCase()
  }

  return null
}

const normalizeName = (name: string): string => {
  if (!name) return ""

  let cleaned = name
    .replace(/(OP\d{2}-\d{3}[A-Z]*)/gi, "")
    .replace(/(ST\d{2}-\d{3}[A-Z]*)/gi, "")
    .replace(/(EB\d{2}-\d{3}[A-Z]*)/gi, "")
    .replace(/(P-\d{3}[A-Z]*)/gi, "")
    .replace(/([A-Z]{2,4}\d{1,2}-\d{3}[A-Z]*)/gi, "")

  cleaned = cleaned.replace(/\s+/g, " ").replace(/[\(\]\[]/g, "").trim().toLowerCase()

  return cleaned
}

const normalizeCode = (code: string): string => {
  if (!code) return ""
  return code.replace(/[-_][A-Z]{1,3}$/, "")
}
