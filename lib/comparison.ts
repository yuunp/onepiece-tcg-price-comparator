import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"

export type BestPrice = "tcg" | "liga" | "tie"
export type MatchStatus = "exact" | "ambiguous" | "unmatched"
/** Kept as a compatibility label for existing callers. Only exact groups are comparisons. */
export type MatchType = "comparison" | "solo"

export interface CanonicalIdentity {
  game: "one-piece"
  setCode: string | null
  cardNumber: string | null
  variant: string | null
  markers: string[]
  language: string | null
  printing: string | null
}

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
  identity: CanonicalIdentity
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
  matchStatus: MatchStatus
  evidence: string[]
  reasons: string[]
}

const DEFAULT_EXCHANGE_RATE = 0.19
const KNOWN_CODE = /^(OP|ST|EB|PRB)\d{2}-\d{3}(?:-[A-Z0-9]+)*$|^(P|DON)-\d{3}(?:-[A-Z0-9]+)*$/
const KNOWN_VARIANT_CODES = new Set(["aa", "pa", "re", "fa", "ch", "pr", "sp", "ma", "g", "gold", "foil"])

export const identifyVariation = (numericCode: string): CardVariation => {
  const variations: Record<string, CardVariation> = {
    AA: { code: "AA", name: "Alternate Art", description: "Arte alternativa", rarity: "Super Rare", emoji: "🎨" },
    RE: { code: "RE", name: "Reprint", description: "Reimpressão", rarity: "Common", emoji: "🔄" },
    FA: { code: "FA", name: "Full Art", description: "Arte completa", rarity: "Rare", emoji: "🖼️" },
    CH: { code: "CH", name: "Championship", description: "Edição de campeonato", rarity: "Promo", emoji: "🥇" },
    PR: { code: "PR", name: "Promo", description: "Cartão promocional", rarity: "Promo", emoji: "🎁" },
    SP: { code: "SP", name: "Special", description: "Edição especial", rarity: "Special", emoji: "✨" },
    MA: { code: "MA", name: "Manga", description: "Manga rare", rarity: "Secret Rare", emoji: "📖" },
    G: { code: "G", name: "Gold/Foil", description: "Gold or foil treatment", rarity: "Special", emoji: "✨" },
    GOLD: { code: "GOLD", name: "Gold/Foil", description: "Gold or foil treatment", rarity: "Special", emoji: "✨" },
    FOIL: { code: "FOIL", name: "Gold/Foil", description: "Gold or foil treatment", rarity: "Special", emoji: "✨" },
  }
  const suffix = numericCode.split("-").pop()?.replace(/^\d+/, "").toUpperCase() || ""
  return variations[suffix] || { code: suffix, name: suffix ? "Unknown variant" : "Unknown variant", description: "Variant not safely identified", rarity: "Unknown", emoji: "?" }
}

export const convertUsdToBrl = (usdPrice: number, exchangeRate: number = DEFAULT_EXCHANGE_RATE): number => usdPrice / exchangeRate

export const buildComparisonGroups = (
  tcgCards: TCGPlayerCard[],
  ligaCards: LigaCard[],
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
): ComparisonGroup[] => {
  const entries = [...tcgCards.map((card) => toTcgEntry(card, exchangeRate)), ...ligaCards.map((card) => toLigaEntry(card, exchangeRate))]
  const grouped = new Map<string, CardEntry[]>()
  const incompleteEntries: CardEntry[] = []

  for (const entry of entries) {
    // A code is a safe candidate boundary, not proof of a match. Same-code variant
    // disagreements stay together for human review; name-only candidates never cross set boundaries.
    const key = entry.identity.setCode && entry.identity.cardNumber
      ? `code:${entry.identity.setCode}-${entry.identity.cardNumber}`
      : ""
    if (key) grouped.set(key, [...(grouped.get(key) || []), entry])
    else incompleteEntries.push(entry)
  }

  for (const entry of incompleteEntries) {
    const candidates = Array.from(grouped.entries()).filter(([key, group]) => key.startsWith("code:") && group.some((candidate) => canReviewTogether(entry, candidate)))
    if (candidates.length === 1) {
      const [key, group] = candidates[0]
      grouped.set(key, [...group, entry])
      continue
    }

    const key = `incomplete:${entry.identity.setCode || "?"}:${normalizeSetName(entry.setName)}:${entry.normalizedName}`
    grouped.set(key, [...(grouped.get(key) || []), entry])
  }

  return Array.from(grouped.entries())
    .map(([groupKey, groupEntries]) => finalizeGroup(groupKey, groupEntries))
    .sort((left, right) => {
      const rank = (status: MatchStatus) => status === "exact" ? 0 : status === "ambiguous" ? 1 : 2
      return rank(left.matchStatus) - rank(right.matchStatus) || right.entries.length - left.entries.length || left.title.localeCompare(right.title)
    })
}

const canReviewTogether = (left: CardEntry, right: CardEntry): boolean => {
  const leftSet = (left.identity.setCode || normalizeSetName(left.setName)).toLowerCase()
  const rightSet = (right.identity.setCode || normalizeSetName(right.setName)).toLowerCase()
  return leftSet !== "" && leftSet === rightSet && left.normalizedName === right.normalizedName
}

const finalizeGroup = (groupKey: string, entries: CardEntry[]): ComparisonGroup => {
  const tcgEntries = entries.filter((entry) => entry.platform === "tcg")
  const ligaEntries = entries.filter((entry) => entry.platform === "liga")
  const title = entries[0]?.displayName || "Unknown card"
  const identity = entries[0]?.identity
  const hasBothSources = tcgEntries.length > 0 && ligaEntries.length > 0
  const sameIdentity = hasBothSources && entries.every((entry) => identityMatches(identity, entry.identity))
  const complete = entries.every((entry) => isCompleteIdentity(entry.identity))
  const matchStatus: MatchStatus = sameIdentity && complete ? "exact" : hasBothSources ? "ambiguous" : complete ? "unmatched" : "ambiguous"
  const evidence = buildEvidence(entries, matchStatus)
  const variantTokens = Array.from(new Set(entries.flatMap((entry) => entry.variantTokens))).sort()
  const code = identity?.setCode && identity.cardNumber ? `${identity.setCode}-${identity.cardNumber}` : ""
  const subtitle = code ? `${code}${variantTokens.length ? ` · ${variantTokens.join(" · ")}` : ""}` : entries[0]?.setName || "Identity details incomplete"
  const reasons = evidence
  const bestTcg = Math.min(...tcgEntries.map((entry) => entry.usdPrice).filter((value) => value > 0), Number.POSITIVE_INFINITY)
  const bestLiga = Math.min(...ligaEntries.map((entry) => entry.usdPrice).filter((value) => value > 0), Number.POSITIVE_INFINITY)
  let bestPrice: BestPrice = "tie"
  let savings = 0
  if (Number.isFinite(bestTcg) && Number.isFinite(bestLiga)) {
    if (bestTcg < bestLiga) { bestPrice = "tcg"; savings = bestLiga - bestTcg }
    else if (bestLiga < bestTcg) { bestPrice = "liga"; savings = bestTcg - bestLiga }
  } else if (Number.isFinite(bestTcg)) bestPrice = "tcg"
  else if (Number.isFinite(bestLiga)) bestPrice = "liga"

  return { groupKey, title, subtitle, entries, tcgEntries, ligaEntries, bestPrice, savings, matchType: matchStatus === "exact" ? "comparison" : "solo", matchStatus, evidence, reasons }
}

export const identityMatches = (left: CanonicalIdentity, right: CanonicalIdentity): boolean =>
  isCompleteIdentity(left) && isCompleteIdentity(right) && left.game === right.game && left.setCode === right.setCode && left.cardNumber === right.cardNumber && left.variant === right.variant && sameMarkers(left.markers, right.markers) && left.language === right.language && left.printing === right.printing

const isCompleteIdentity = (identity: CanonicalIdentity): boolean => Boolean(identity.setCode && identity.cardNumber && identity.variant && identity.variant !== "unknown")
const sameMarkers = (left: string[], right: string[]) => left.length === right.length && left.every((value, index) => value === right[index])

const buildEvidence = (entries: CardEntry[], status: MatchStatus): string[] => {
  const evidence: string[] = []
  const identities = entries.map((entry) => entry.identity)
  const first = identities[0]
  if (identities.some((identity) => !identity.setCode || !identity.cardNumber)) evidence.push("Card code or number is missing from at least one listing")
  else if (first?.setCode && first.cardNumber) evidence.push(`Exact code ${first.setCode}-${first.cardNumber}`)
  else evidence.push("Card code or number is missing from at least one listing")
  const variants = Array.from(new Set(entries.map((entry) => entry.identity.variant || "unknown")))
  if (variants.length > 1) evidence.push(`Variants differ: ${variants.join(" / ")}`)
  else if (variants[0] === "unknown") evidence.push("Variant is not reliably identified")
  else evidence.push(`Variant: ${variants[0]}`)
  const languages = Array.from(new Set(identities.map((identity) => identity.language).filter((language): language is string => Boolean(language))))
  if (languages.length > 1) evidence.push(`Languages differ: ${languages.join(" / ")}`)
  else if (languages.length === 1 && identities.some((identity) => !identity.language)) evidence.push("Language is missing from at least one listing")
  if (identities.some((identity) => identity.markers.includes("promo"))) evidence.push("Promo marker retained")
  if (identities.some((identity) => identity.markers.includes("reprint"))) evidence.push("Reprint marker retained")
  if (status === "exact") evidence.push("Both sources agree on the available identity fields")
  else if (status === "ambiguous") evidence.push("Needs identity review before comparing prices")
  else evidence.push("No verified counterpart returned")
  return evidence
}

const toTcgEntry = (card: TCGPlayerCard, exchangeRate: number): CardEntry => {
  const rawCode = card.extendedData?.find((detail) => detail.name.toLowerCase() === "number")?.value || extractCardNumber(card.name) || ""
  const identity = buildIdentity(rawCode, card.name, card.groupName || card.setName || "", card.setCode)
  const usdPrice = card.price?.marketPrice || 0
  return { id: `tcg:${card.productId}`, code: rawCode, baseCode: identity.setCode && identity.cardNumber ? `${identity.setCode}-${identity.cardNumber}` : "", displayName: getDisplayName(card.name), normalizedName: normalizeIdentityName(card.name), setName: card.groupName || card.setName || "", variantTokens: identity.variant && identity.variant !== "base" ? [identity.variant] : [], identity, platform: "tcg", tcgCard: card, usdPrice, brlPrice: usdPrice > 0 ? convertUsdToBrl(usdPrice, exchangeRate) : 0 }
}

const toLigaEntry = (card: LigaCard, exchangeRate: number): CardEntry => {
  const rawCode = card.numericCode || ""
  const identity = buildIdentity(rawCode, card.name, card.set || "")
  const brlPrice = card.price || 0
  return { id: `liga:${rawCode || normalizeIdentityName(card.name)}`, code: rawCode, baseCode: identity.setCode && identity.cardNumber ? `${identity.setCode}-${identity.cardNumber}` : "", displayName: getDisplayName(card.name), normalizedName: normalizeIdentityName(card.name), setName: card.set || "", variantTokens: identity.variant && identity.variant !== "base" ? [identity.variant] : [], identity, platform: "liga", ligaCard: card, usdPrice: brlPrice > 0 ? brlPrice * exchangeRate : 0, brlPrice }
}

export const buildIdentity = (rawCode: string, name: string, setName: string, explicitSetCode?: string): CanonicalIdentity => {
  const cleaned = normalizeRawCode(rawCode || extractCardNumber(name) || "")
  const parsed = parseCode(cleaned)
  const setCode = parsed?.setCode || normalizeSetCode(explicitSetCode)
  const cardNumber = parsed?.cardNumber || null
  const markers = extractMarkers(name, rawCode)
  const variant = parsed?.variant === "unknown" ? "unknown" : markers.length ? markers.join("+") : (parsed?.variant || null)
  return { game: "one-piece", setCode, cardNumber, variant, markers, language: extractLanguage(name), printing: null }
}

const parseCode = (code: string): { setCode: string; cardNumber: string; variant: string | null } | null => {
  if (!KNOWN_CODE.test(code)) return null
  if (code.startsWith("P-") || code.startsWith("DON-")) {
    const [setCode, cardNumber, ...suffix] = code.split("-")
    const variantCode = suffix.join("-").toLowerCase()
    return { setCode, cardNumber, variant: suffix.length ? (KNOWN_VARIANT_CODES.has(variantCode) ? variantCode : "unknown") : "base" }
  }
  const [setCode, cardNumber, ...suffix] = code.split("-")
  const variantCode = suffix.join("-").toLowerCase()
  return { setCode, cardNumber, variant: suffix.length ? (KNOWN_VARIANT_CODES.has(variantCode) ? variantCode : "unknown") : "base" }
}

const normalizeRawCode = (value: string): string => value.toUpperCase().replace(/\s+/g, "").replace(/^\(|\)$/g, "").replace(/\((?:TCGPLAYER|LIGA|EN|JP|SOURCE)\)$/i, "")
const normalizeSetCode = (value?: string): string | null => {
  const normalized = normalizeRawCode(value || "")
  return /^(OP|ST|EB|PRB)\d{2}$/.test(normalized) ? normalized : null
}

const extractCardNumber = (name: string): string | null => {
  const match = name.match(/\b((?:OP|ST|EB|PRB)\d{2}-\d{3}(?:-[A-Z0-9]+)*|P-\d{3}(?:-[A-Z0-9]+)*|DON-[A-Z0-9-]+)\b/i)
  return match?.[1]?.toUpperCase() || null
}

const extractMarkers = (name: string, code: string): string[] => {
  const lower = `${name} ${code}`.toLowerCase()
  const markers = new Set<string>()
  if (/alternate[\s_-]+art|\bparallel\b|-(aa|pa)\b/.test(lower)) markers.add("alternate-art")
  if (/\bpromo(?:tional)?\b|-pr\b/.test(lower)) markers.add("promo")
  if (/\bchampionship\b|-ch\b/.test(lower)) markers.add("championship")
  if (/\breprint(?:s|ed)?\b|-re\b/.test(lower)) markers.add("reprint")
  if (/\bmanga\b|-ma\b/.test(lower)) markers.add("manga")
  if (/\bgold\b|\bfoil\b|pirate foil|-g(?:old)?\b/.test(lower)) markers.add("gold/foil")
  if (/\bspecial\b|-sp\b/.test(lower)) markers.add("special")
  if (/\bfull[- ]art\b|-fa\b/.test(lower)) markers.add("full-art")
  return Array.from(markers).sort()
}

const extractLanguage = (name: string): string | null => {
  const match = name.match(/\((en|jp|english|japanese)\)/i)
  if (!match) return null
  const language = match[1].toLowerCase()
  return language === "english" ? "en" : language === "japanese" ? "jp" : language
}

const normalizeIdentityName = (name: string): string => getDisplayName(name).replace(/\b(?:OP|ST|EB|PRB)\d{2}-\d{3}(?:-[A-Z0-9]+)*\b|\bP-\d{3}(?:-[A-Z0-9]+)*\b|\bDON-[A-Z0-9-]+\b/gi, " ").toLowerCase().replace(/monkey\.d\./g, "luffy").replace(/monkey d luffy/g, "luffy").replace(/[^a-z0-9&!?']+/g, " ").replace(/\s+/g, " ").trim()
const getDisplayName = (name: string): string => name.replace(/\s*\((?:tcgplayer|liga|source)\)\s*/gi, " ").replace(/\s+/g, " ").trim()
const normalizeSetName = (setName: string): string => setName.toLowerCase().replace(/starter deck[^a-z0-9]*/g, "st").replace(/premium booster[^a-z0-9]*/g, "prb").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
