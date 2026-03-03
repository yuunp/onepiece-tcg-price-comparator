"use client"

import React from "react"
import { ExternalLink, CheckCircle, AlertTriangle, Hash, Package, Sparkles, ArrowUpDown, Crown, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { TCGPlayerCard } from "@/lib/tcgplayer"
import type { LigaCard } from "@/lib/liga"
import { useMemo } from "react"

type BestPrice = "tcg" | "liga" | "tie"
type MatchType = "perfect" | "high" | "medium" | "none"

interface CardVariation {
  code: string
  name: string
  description: string
  rarity?: string
  emoji: string
}

interface CardMatch {
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

interface PriceComparisonProps {
  tcgResults: TCGPlayerCard[]
  ligaResults: LigaCard[]
  exchangeRate?: number
}

const identifyVariation = (numericCode: string): CardVariation => {
  const variations: { [key: string]: CardVariation } = {
    'E': { code: 'E', name: 'Special', description: 'Edição especial', rarity: 'Special', emoji: '⭐' },
    'AA': { code: 'AA', name: 'Alternate Art', description: 'Arte alternativa', rarity: 'Super Rare', emoji: '🎨' },
    'RE': { code: 'RE', name: 'Reprint', description: 'Reimpressão', rarity: 'Common', emoji: '🔄' },
    'FA': { code: 'FA', name: 'Full Art', description: 'Arte completa', rarity: 'Rare', emoji: '🖼️' },
    'AS': { code: 'AS', name: 'Anniversary Set', description: 'Edição de aniversário', rarity: 'Secret Rare', emoji: '🎂' },
    'BS': { code: 'BS', name: 'Best Selection', description: 'Seleção especial', rarity: 'Super Rare', emoji: '🏆' },
    'CH': { code: 'CH', name: 'Championship', description: 'Edição de campeonato', rarity: 'Promo', emoji: '🥇' },
    'PR': { code: 'PR', name: 'Promo', description: 'Cartão promocional', rarity: 'Promo', emoji: '🎁' },
    'SP': { code: 'SP', name: 'Special', description: 'Edição especial', rarity: 'Special', emoji: '✨' },
    'SR': { code: 'SR', name: 'Super Rare', description: 'Super rara', rarity: 'Super Rare', emoji: '💎' }
  }

  const suffix = numericCode.split('-').pop()?.replace(/^\d+/, '') || ''

  return variations[suffix] || {
    code: suffix,
    name: 'Standard',
    description: 'Versão padrão',
    rarity: 'Normal',
    emoji: '📄'
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
    /([A-Z]{2,4}\d{1,2}-\d{3}[A-Z]*)/i
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) return match[1].toUpperCase()
  }

  return null
}

const normalizeName = (name: string): string => {
  if (!name) return ''

  let cleaned = name.replace(/(OP\d{2}-\d{3}[A-Z]*)/gi, '')
    .replace(/(ST\d{2}-\d{3}[A-Z]*)/gi, '')
    .replace(/(EB\d{2}-\d{3}[A-Z]*)/gi, '')
    .replace(/(P-\d{3}[A-Z]*)/gi, '')
    .replace(/([A-Z]{2,4}\d{1,2}-\d{3}[A-Z]*)/gi, '')

  cleaned = cleaned.replace(/\s+/g, ' ')
    .replace(/[\(\]\[]/g, '')
    .trim()
    .toLowerCase()

  return cleaned
}

const normalizeCode = (code: string): string => {
  if (!code) return ''
  return code.replace(/[-_][A-Z]{1,3}$/, '')
}

const calculateSimilarity = (tcgCard: TCGPlayerCard, ligaCard: LigaCard): {
  score: number
  reasons: string[]
  method: string
} => {
  const reasons: string[] = []
  let totalScore = 0

  const tcgSetName = (tcgCard as any).groupName?.toLowerCase().trim()
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
    } else if (tcgNameNormalized.includes(ligaNameNormalized) ||
      ligaNameNormalized.includes(tcgNameNormalized)) {
      totalScore += 0
      reasons.push(`Names similar: "${tcgNameNormalized}" ~ "${ligaNameNormalized}" (25%)`)
    }
  }

  const tcgCode = tcgCard.extendedData?.find(d => d.name === 'Number')?.value || extractCardNumber(tcgCard.name)
  const ligaCode = ligaCard.numericCode

  if (tcgCode && ligaCode) {
    const tcgBase = normalizeCode(tcgCode)
    const ligaBase = normalizeCode(ligaCode)

    if (tcgBase === ligaBase) {
      totalScore += 30
      reasons.push(`Base code: ${tcgBase} (30%)`)
    } else {
      const tcgSetFromCode = tcgCode.split('-')[0]
      const ligaSetFromCode = ligaCode.split('-')[0]
      if (tcgSetFromCode === ligaSetFromCode) {
        totalScore += 15
        reasons.push(`Same set in code: ${tcgSetFromCode} (15%)`)
      }
    }
  }

  const finalScore = Math.min(totalScore / 100, 1)

  let method = 'Basic Matching'
  if (finalScore >= 0.9) method = 'Perfect Match'
  else if (finalScore >= 0.7) method = 'Good Match'
  else if (finalScore >= 0.5) method = 'Partial Match'

  return { score: finalScore, reasons, method }
}

const matchCards = (tcgCards: TCGPlayerCard[], ligaCards: LigaCard[]): CardMatch[] => {
  const matches: CardMatch[] = []
  const usedLigaIndices = new Set<number>()
  const usedTcgIndices = new Set<number>()

  tcgCards.forEach((tcgCard, tcgIndex) => {
    let bestMatch = { index: -1, score: 0, analysis: { score: 0, reasons: [] as string[], method: '' } }
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
      matches.push(createCardMatch(tcgCard, ligaCards[bestMatch.index], bestMatch.analysis))
    }
  })

  tcgCards.forEach((tcgCard, tcgIndex) => {
    if (usedTcgIndices.has(tcgIndex)) return
    let bestMatch = { index: -1, score: 0, analysis: { score: 0, reasons: [] as string[], method: '' } }
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
      matches.push(createCardMatch(tcgCard, ligaCards[bestMatch.index], bestMatch.analysis))
    }
  })

  tcgCards.forEach((card, index) => {
    if (!usedTcgIndices.has(index)) {
      matches.push({
        tcgCard: card, similarity: 0, bestPrice: "tcg", matchType: "none",
        matchMethod: 'No match found', confidenceScore: 0, matchReasons: ['No match found']
      })
    }
  })

  ligaCards.forEach((card, index) => {
    if (!usedLigaIndices.has(index)) {
      matches.push({
        ligaCard: card, similarity: 0, bestPrice: "liga", matchType: "none",
        matchMethod: 'No match found', confidenceScore: 0, matchReasons: ['No match found']
      })
    }
  })

  return matches
}

const createCardMatch = (tcgCard: TCGPlayerCard, ligaCard: LigaCard, analysis: {
  score: number; reasons: string[]; method: string
}): CardMatch => {
  const tcgPrice = tcgCard.price?.marketPrice || 0
  const ligaPriceUSD = ligaCard.price * 0.19

  let bestPrice: BestPrice = "tie"
  let savings = 0

  if (tcgPrice < ligaPriceUSD) { bestPrice = "tcg"; savings = ligaPriceUSD - tcgPrice }
  else if (tcgPrice > ligaPriceUSD) { bestPrice = "liga"; savings = tcgPrice - ligaPriceUSD }

  let matchType: MatchType = "none"
  if (analysis.score >= 0.9) matchType = "perfect"
  else if (analysis.score >= 0.7) matchType = "high"
  else if (analysis.score >= 0.5) matchType = "medium"

  return {
    tcgCard, ligaCard, similarity: analysis.score, bestPrice, savings, matchType,
    matchMethod: analysis.method, confidenceScore: Math.round(analysis.score * 100),
    matchReasons: analysis.reasons
  }
}

const formatCurrency = (amount: number, currency: string = "USD"): string => {
  if (amount == null || isNaN(amount)) return "N/A"
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency === "BRL" ? "BRL" : "USD",
  }).format(amount)
}

export const PriceComparison = ({ tcgResults, ligaResults, exchangeRate = 0.19 }: PriceComparisonProps) => {
  const [sortBy, setSortBy] = React.useState<'savings' | 'match' | 'price-low' | 'price-high'>('savings')

  const matches = useMemo(() => {
    if (!tcgResults || !ligaResults) return []
    return matchCards(tcgResults, ligaResults)
  }, [tcgResults, ligaResults])

  const sortedMatches = useMemo(() => {
    const sorted = [...matches]
    switch (sortBy) {
      case 'savings':
        return sorted.sort((a, b) => (b.savings || 0) - (a.savings || 0))
      case 'match':
        return sorted.sort((a, b) => {
          const matchOrder = { 'perfect': 3, 'high': 2, 'medium': 1, 'none': 0 }
          return matchOrder[b.matchType as keyof typeof matchOrder] - matchOrder[a.matchType as keyof typeof matchOrder]
        })
      case 'price-low': {
        return sorted.sort((a, b) => {
          const priceA = Math.min(a.tcgCard?.price?.marketPrice || Infinity, a.ligaCard?.price ? a.ligaCard.price * exchangeRate : Infinity)
          const priceB = Math.min(b.tcgCard?.price?.marketPrice || Infinity, b.ligaCard?.price ? b.ligaCard.price * exchangeRate : Infinity)
          return priceA - priceB
        })
      }
      case 'price-high': {
        return sorted.sort((a, b) => {
          const priceA = Math.max(a.tcgCard?.price?.marketPrice || 0, a.ligaCard?.price ? a.ligaCard.price * exchangeRate : 0)
          const priceB = Math.max(b.tcgCard?.price?.marketPrice || 0, b.ligaCard?.price ? b.ligaCard.price * exchangeRate : 0)
          return priceB - priceA
        })
      }
      default:
        return sorted
    }
  }, [matches, sortBy, exchangeRate])

  const stats = useMemo(() => ({
    perfect: matches.filter(m => m.matchType === 'perfect').length,
    high: matches.filter(m => m.matchType === 'high').length,
    medium: matches.filter(m => m.matchType === 'medium').length,
    none: matches.filter(m => m.matchType === 'none').length,
    tcgBetter: matches.filter(m => m.bestPrice === "tcg" && m.savings && m.savings > 0).length,
    ligaBetter: matches.filter(m => m.bestPrice === "liga" && m.savings && m.savings > 0).length,
    totalSavings: matches.reduce((sum, m) => sum + (m.savings || 0), 0)
  }), [matches])

  if (!tcgResults || !ligaResults) {
    return <div className="text-muted-foreground text-sm">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard value={stats.perfect} label="Perfect Matches" icon={<Sparkles className="h-4 w-4" />} color="text-[#34d399]" />
        <StatCard value={stats.high + stats.medium} label="Good Matches" icon={<CheckCircle className="h-4 w-4" />} color="text-[#60a5fa]" />
        <StatCard value={stats.none} label="No Match" icon={<AlertTriangle className="h-4 w-4" />} color="text-muted-foreground" />
        <StatCard value={formatCurrency(stats.totalSavings)} label="Total Potential Savings" icon={<Crown className="h-4 w-4" />} color="text-primary" />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sort matches:</span>
        {([
          { key: 'savings' as const, label: 'Best Deals' },
          { key: 'match' as const, label: 'Best Match' },
          { key: 'price-low' as const, label: 'Lowest Price' },
          { key: 'price-high' as const, label: 'Highest Price' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${sortBy === key
              ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(129,140,248,0.3)]'
              : 'glass text-muted-foreground hover:text-foreground hover:bg-white/5 border border-border/50'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Match cards */}
      <div className="flex flex-col gap-4">
        {sortedMatches.map((match, index) => {
          const ligaPriceUSD = match.ligaCard?.price ? match.ligaCard.price * exchangeRate : 0
          const ligaVariation = match.ligaCard?.numericCode ? identifyVariation(match.ligaCard.numericCode) : null

          return (
            <div
              key={index}
              className={`glass rounded-2xl overflow-hidden card-hover transition-all duration-300 border ${match.matchType === 'perfect' ? 'border-[#34d399]/40 shadow-[0_0_20px_rgba(52,211,153,0.1)]' :
                match.matchType === 'high' ? 'border-[#60a5fa]/40 shadow-[0_0_20px_rgba(96,165,250,0.1)]' :
                  match.matchType === 'medium' ? 'border-primary/40' :
                    'border-border/40'
                }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="p-6">
                {/* Two-column card layout */}
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 relative">
                  {/* Divider line for desktop */}
                  <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-border to-transparent -translate-x-1/2" />

                  {/* TCGPlayer side */}
                  {match.tcgCard && (
                    <CardSide
                      platform="tcg"
                      name={match.tcgCard.name}
                      imageUrl={match.tcgCard.imageUrl}
                      code={match.tcgCard.extendedData?.find(d => d.name === 'Number')?.value || 'No Code'}
                      setName={(match.tcgCard as any).groupName}
                      price={match.tcgCard.price?.marketPrice != null ? `$${match.tcgCard.price.marketPrice.toFixed(2)}` : 'N/A'}
                      url={match.tcgCard.url}
                      isBest={match.bestPrice === "tcg"}
                    />
                  )}

                  {/* Liga side */}
                  {match.ligaCard && (
                    <CardSide
                      platform="liga"
                      name={match.ligaCard.name}
                      imageUrl={match.ligaCard.imageUrl}
                      code={match.ligaCard.numericCode || 'No Code'}
                      setName={match.ligaCard.set}
                      variation={ligaVariation?.name !== 'Standard' ? ligaVariation?.name : undefined}
                      price={`R$ ${match.ligaCard.price?.toFixed(2) || 'N/A'}`}
                      priceSecondary={ligaPriceUSD > 0 ? `${formatCurrency(ligaPriceUSD)}` : undefined}
                      url={match.ligaCard.url}
                      isBest={match.bestPrice === "liga"}
                    />
                  )}
                </div>

                {/* Match info footer */}
                <div className={`mt-6 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md ${match.matchType === 'perfect' ? 'bg-[#34d399]/5 border border-[#34d399]/20' :
                  match.matchType === 'high' ? 'bg-[#60a5fa]/5 border border-[#60a5fa]/20' :
                    match.matchType === 'medium' ? 'bg-primary/5 border border-primary/20' :
                      'bg-white/5 border border-white/10'
                  }`}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {match.matchType === "perfect" && (
                      <Badge className="bg-[#34d399]/10 text-[#34d399] border-none text-[12px] font-bold px-2.5 py-1">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Perfect Match ({match.confidenceScore}%)
                      </Badge>
                    )}
                    {match.matchType === "high" && (
                      <Badge className="bg-[#60a5fa]/10 text-[#60a5fa] border-none text-[12px] font-bold px-2.5 py-1">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Solid Match ({match.confidenceScore}%)
                      </Badge>
                    )}
                    {match.matchType === "medium" && (
                      <Badge className="bg-primary/10 text-primary border-none text-[12px] font-bold px-2.5 py-1">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        Partial Match ({match.confidenceScore}%)
                      </Badge>
                    )}
                    {match.matchType === "none" && (
                      <Badge className="bg-muted border-none text-[12px] text-muted-foreground font-bold px-2.5 py-1">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        No Match Found
                      </Badge>
                    )}

                    {/* Reasons as small inline text */}
                    {match.matchReasons.length > 0 && match.matchType !== 'none' && (
                      <span className="text-[11px] text-muted-foreground/80 font-medium hidden sm:inline ml-2">
                        {match.matchReasons[0]}
                      </span>
                    )}
                  </div>

                  {match.savings && match.savings > 0 && (
                    <Badge className={`text-xs font-bold gap-1.5 px-3 py-1 scale-105 origin-right border-none ${match.bestPrice === "tcg"
                      ? 'bg-[#60a5fa]/15 text-[#60a5fa] shadow-[0_0_10px_rgba(96,165,250,0.2)]'
                      : 'bg-[#34d399]/15 text-[#34d399] shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                      }`}>
                      <Crown className="w-3.5 h-3.5" />
                      Save {formatCurrency(match.savings)} on {match.bestPrice === "tcg" ? "TCGPlayer" : "Liga"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


function StatCard({ value, label, icon, color }: { value: string | number; label: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass border border-border/50 rounded-2xl p-5 flex items-start justify-between relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 group-hover:opacity-20 transition-all duration-500">
        <div className={`w-12 h-12 ${color}`}>{icon}</div>
      </div>
      <div className="relative z-10">
        <div className={`text-3xl font-extrabold font-mono tracking-tight drop-shadow-sm ${color}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground font-bold mt-2 uppercase tracking-widest">{label}</div>
      </div>
    </div>
  )
}

function CardSide({
  platform,
  name,
  imageUrl,
  code,
  setName,
  variation,
  price,
  priceSecondary,
  url,
  isBest,
}: {
  platform: "tcg" | "liga"
  name: string
  imageUrl?: string
  code: string
  setName?: string
  variation?: string
  price: string
  priceSecondary?: string
  url: string
  isBest: boolean
}) {
  return (
    <div className={`flex gap-5 group rounded-xl p-2 transition-all ${isBest ? 'bg-primary/5 -m-2' : ''}`}>
      {/* Thumbnail */}
      <div className="w-[84px] h-[116px] rounded-xl overflow-hidden bg-secondary/30 flex-shrink-0 border border-border/50 shadow-sm relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:scale-[1.05]"
            onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-medium border border-dashed border-border/50">
            No img
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col pt-1">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${platform === 'tcg' ? 'platform-tcg' : 'platform-liga'}`}>
            {platform === 'tcg' ? 'TCGPlayer' : 'Liga One Piece'}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono font-medium flex items-center gap-0.5 bg-secondary/30 px-1.5 rounded-md">
            <Hash className="w-3 h-3 text-muted-foreground/70" />{code}
          </span>
        </div>

        <h4 className="font-bold text-[15px] text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">{name}</h4>

        <div className="text-xs text-muted-foreground/80 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-medium">
          {setName && (
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-muted-foreground/60" />{setName}
            </span>
          )}
          {variation && (
            <span className="flex items-center gap-1.5 text-primary drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]">
              <Sparkles className="w-3.5 h-3.5" />{variation}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3 flex items-end justify-between border-t border-border/20">
          <div>
            <div className={`text-xl font-extrabold font-mono leading-none tracking-tight ${isBest ? 'text-primary drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]' : 'text-foreground'}`}>
              {price}
            </div>
            {priceSecondary && (
              <div className="text-[12px] text-muted-foreground/70 font-mono font-medium mt-1">{'≈'} {priceSecondary}</div>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hover:text-primary transition-colors bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg"
          >
            Visit <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
