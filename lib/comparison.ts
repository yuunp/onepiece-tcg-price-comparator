import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"

export type BestPrice = "tcg" | "liga" | "tie"
export type MatchType = "comparison" | "solo"

export interface CardVariation {
  code: string
  name: string
  description: string
  rarity?: string
  emoji: string
}

export interface CardEntry {
  id: string
  code: string
  baseCode: string
  displayName: string
  normalizedName: string
  setName: string
  variantTokens: string[]
  platform: "tcg" | "liga"
  tcgCard?: TCGPlayerCard
  ligaCard?: LigaCard
  usdPrice: number
  brlPrice: number
}

export interface ComparisonGroup {
  groupKey: string
  title: string
  subtitle?: string
  entries: CardEntry[]
  tcgEntries: CardEntry[]
  ligaEntries: CardEntry[]
  bestPrice: BestPrice
  savings?: number
  matchType: MatchType
  reasons: string[]
}

const DEFAULT_EXCHANGE_RATE = 0.19
const VERSION_WORDS = ["alternate art", "parallel", "pirate foil", "gold", "foil", "reprint", "manga", "special", "promo", "full art"]

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
  return variations[suffix] || { code: suffix, name: "Standard", description: "Versão padrão", rarity: "Normal", emoji: "📄" }
}

export const convertUsdToBrl = (usdPrice: number, exchangeRate: number = DEFAULT_EXCHANGE_RATE): number => usdPrice / exchangeRate

export const buildComparisonGroups = (
  tcgCards: TCGPlayerCard[],
  ligaCards: LigaCard[],
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
): ComparisonGroup[] => {
  const entries = [...tcgCards.map((card) => toTcgEntry(card, exchangeRate)), ...ligaCards.map((card) => toLigaEntry(card, exchangeRate))]
  const grouped = new Map<string, CardEntry[]>()

  for (const entry of entries) {
    const key = `${entry.normalizedName}::${entry.baseCode || "no-code"}`
    const list = grouped.get(key) || []
    list.push(entry)
    grouped.set(key, list)
  }

  return Array.from(grouped.entries())
    .map(([groupKey, groupEntries]) => finalizeGroup(groupKey, groupEntries))
    .sort((left, right) => {
      if (left.matchType !== right.matchType) {
        return left.matchType === "comparison" ? -1 : 1
      }
      const coverageDiff = right.entries.length - left.entries.length
      if (coverageDiff !== 0) return coverageDiff
      return left.title.localeCompare(right.title)
    })
}

const finalizeGroup = (groupKey: string, entries: CardEntry[]): ComparisonGroup => {
  const tcgEntries = entries.filter((entry) => entry.platform === "tcg")
  const ligaEntries = entries.filter((entry) => entry.platform === "liga")
  const title = entries[0]?.displayName || "Unknown card"
  const baseCode = entries.find((entry) => entry.baseCode)?.baseCode || ""
  const subtitle = baseCode || entries[0]?.setName || undefined
  const reasons: string[] = []

  if (baseCode) reasons.push(`Grouped by card identity: ${baseCode}`)
  if (tcgEntries.length && ligaEntries.length) reasons.push("Both marketplaces have this card family")

  let bestPrice: BestPrice = "tie"
  let savings = 0
  const bestTcg = Math.min(...tcgEntries.map((entry) => entry.usdPrice).filter((value) => value > 0), Number.POSITIVE_INFINITY)
  const bestLiga = Math.min(...ligaEntries.map((entry) => entry.usdPrice).filter((value) => value > 0), Number.POSITIVE_INFINITY)

  if (Number.isFinite(bestTcg) && Number.isFinite(bestLiga)) {
    if (bestTcg < bestLiga) {
      bestPrice = "tcg"
      savings = bestLiga - bestTcg
    } else if (bestLiga < bestTcg) {
      bestPrice = "liga"
      savings = bestTcg - bestLiga
    }
  } else if (Number.isFinite(bestTcg)) {
    bestPrice = "tcg"
  } else if (Number.isFinite(bestLiga)) {
    bestPrice = "liga"
  }

  return {
    groupKey,
    title,
    subtitle,
    entries,
    tcgEntries,
    ligaEntries,
    bestPrice,
    savings,
    matchType: tcgEntries.length && ligaEntries.length ? "comparison" : "solo",
    reasons,
  }
}

const toTcgEntry = (card: TCGPlayerCard, exchangeRate: number): CardEntry => {
  const code = getTcgCode(card)
  const baseCode = getBaseCode(code, card.name, card.groupName || card.setName || "")
  const normalizedName = normalizeIdentityName(card.name)
  const usdPrice = card.price?.marketPrice || 0
  return {
    id: `tcg:${card.productId}`,
    code,
    baseCode,
    displayName: getDisplayName(card.name),
    normalizedName,
    setName: card.groupName || card.setName || "",
    variantTokens: extractVariantTokens(card.name, code),
    platform: "tcg",
    tcgCard: card,
    usdPrice,
    brlPrice: usdPrice > 0 ? convertUsdToBrl(usdPrice, exchangeRate) : 0,
  }
}

const toLigaEntry = (card: LigaCard, exchangeRate: number): CardEntry => {
  const code = card.numericCode || ""
  const baseCode = getBaseCode(code, card.name, card.set || "")
  const normalizedName = normalizeIdentityName(card.name)
  const brlPrice = card.price || 0
  return {
    id: `liga:${code || normalizeIdentityName(card.name)}`,
    code,
    baseCode,
    displayName: getDisplayName(card.name),
    normalizedName,
    setName: card.set || "",
    variantTokens: extractVariantTokens(card.name, code),
    platform: "liga",
    ligaCard: card,
    usdPrice: brlPrice > 0 ? brlPrice * exchangeRate : 0,
    brlPrice,
  }
}

const getTcgCode = (card: TCGPlayerCard): string => {
  return card.extendedData?.find((detail) => detail.name === "Number")?.value || extractCardNumber(card.name) || ""
}

const getBaseCode = (code: string, name: string, setName: string): string => {
  const explicit = normalizeCode(code)
  if (explicit) return explicit

  const inferred = inferSpecialCode(name, setName)
  if (inferred) return inferred

  return normalizeIdentityName(name)
}

const normalizeCode = (code?: string | null): string => {
  if (!code) return ""
  return code.toUpperCase().replace(/\s+/g, "").replace(/\((.*?)\)/g, "").replace(/-(AA|PA|SP|PR|RE|FA|G|GOLD)$/i, "")
}

const extractCardNumber = (name: string): string | null => {
  if (!name) return null
  const patterns = [/(PRB\d{2}-\d{3}[A-Z-]*)/i, /(OP\d{2}-\d{3}[A-Z-]*)/i, /(ST\d{2}-\d{3}[A-Z-]*)/i, /(EB\d{2}-\d{3}[A-Z-]*)/i, /(P-\d{3}[A-Z-]*)/i, /(DON-[A-Z0-9-]+)/i]
  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) return match[1].toUpperCase()
  }
  return null
}

const inferSpecialCode = (name: string, setName: string): string => {
  const lower = name.toLowerCase()
  const set = (setName || "").toLowerCase()
  if (lower.includes("don!! card") && lower.includes("luffy") && set.includes("premium booster") && set.includes("best")) {
    if (lower.includes("gear 4") || lower.includes("gear4")) return "DON-009"
    if (lower.includes("gear 5") || lower.includes("gear5")) return "DON-010"
  }
  return ""
}

const normalizeIdentityName = (name: string): string => {
  return getDisplayName(name)
    .toLowerCase()
    .replace(/monkey\.d\./g, "luffy")
    .replace(/monkey d luffy/g, "luffy")
    .replace(/\bluffy\b/g, "luffy")
    .replace(/\b(gear\s*5|gear5)\b/g, "gear5")
    .replace(/\b(gear\s*4|gear4)\b/g, "gear4")
    .replace(/[^a-z0-9&!?' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const getDisplayName = (name: string): string => name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim()

const extractVariantTokens = (name: string, code: string): string[] => {
  const lower = `${name} ${code}`.toLowerCase()
  return VERSION_WORDS.filter((token) => lower.includes(token)).sort()
}
