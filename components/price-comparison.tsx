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

  const tcgSetName = tcgCard.setName?.toLowerCase().trim()
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

/* ================================================================
   COMPONENT
   ================================================================ */

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        <StatCard value={stats.perfect} label="Perfect Matches" color="text-[#059669]" />
        <StatCard value={stats.high + stats.medium} label="Good Matches" color="text-[#2563eb]" />
        <StatCard value={stats.none} label="No Match" color="text-muted-foreground" />
        <StatCard value={formatCurrency(stats.totalSavings)} label="Potential Savings" color="text-primary" />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Sort:</span>
        {([
          { key: 'savings' as const, label: 'Best Deals' },
          { key: 'match' as const, label: 'Best Match' },
          { key: 'price-low' as const, label: 'Lowest Price' },
          { key: 'price-high' as const, label: 'Highest Price' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sortBy === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:text-foreground border border-border'
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
              className={`bg-card border rounded-xl overflow-hidden card-hover transition-all ${
                match.matchType === 'perfect' ? 'border-[#059669]/30' :
                match.matchType === 'high' ? 'border-[#2563eb]/30' :
                match.matchType === 'medium' ? 'border-primary/30' :
                'border-border'
              }`}
            >
              <div className="p-5">
                {/* Two-column card layout */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* TCGPlayer side */}
                  {match.tcgCard && (
                    <CardSide
                      platform="tcg"
                      name={match.tcgCard.name}
                      imageUrl={match.tcgCard.imageUrl}
                      code={match.tcgCard.extendedData?.find(d => d.name === 'Number')?.value || 'No Code'}
                      setName={match.tcgCard.setName}
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
                <div className={`mt-5 p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  match.matchType === 'perfect' ? 'bg-[#059669]/5 border border-[#059669]/15' :
                  match.matchType === 'high' ? 'bg-[#2563eb]/5 border border-[#2563eb]/15' :
                  match.matchType === 'medium' ? 'bg-primary/5 border border-primary/15' :
                  'bg-secondary border border-border'
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {match.matchType === "perfect" && (
                      <Badge className="bg-[#059669]/10 text-[#059669] border border-[#059669]/20 text-[11px] font-semibold">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Perfect ({match.confidenceScore}%)
                      </Badge>
                    )}
                    {match.matchType === "high" && (
                      <Badge className="bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 text-[11px] font-semibold">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Good ({match.confidenceScore}%)
                      </Badge>
                    )}
                    {match.matchType === "medium" && (
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Medium ({match.confidenceScore}%)
                      </Badge>
                    )}
                    {match.matchType === "none" && (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground font-semibold">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        No Match
                      </Badge>
                    )}

                    {/* Reasons as small inline text */}
                    {match.matchReasons.length > 0 && match.matchType !== 'none' && (
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        {match.matchReasons[0]}
                      </span>
                    )}
                  </div>

                  {match.savings && match.savings > 0 && (
                    <Badge className={`text-[11px] font-semibold gap-1 ${
                      match.bestPrice === "tcg"
                        ? 'bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20'
                        : 'bg-[#059669]/10 text-[#059669] border border-[#059669]/20'
                    }`}>
                      <Crown className="w-3 h-3" />
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

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground font-medium mt-1.5 uppercase tracking-wider">{label}</div>
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
    <div className="flex gap-4">
      {/* Thumbnail */}
      <div className="w-[72px] h-[100px] rounded-lg overflow-hidden bg-secondary flex-shrink-0 border border-border">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
            No img
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platform === 'tcg' ? 'platform-tcg' : 'platform-liga'}`}>
            {platform === 'tcg' ? 'TCGPlayer' : 'Liga One Piece'}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
            <Hash className="w-2.5 h-2.5" />{code}
          </span>
        </div>

        <h4 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">{name}</h4>

        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {setName && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />{setName}
            </span>
          )}
          {variation && (
            <span className="flex items-center gap-1 text-primary">
              <Sparkles className="w-3 h-3" />{variation}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2 flex items-end justify-between">
          <div>
            <div className="text-base font-bold text-foreground font-mono leading-none">{price}</div>
            {priceSecondary && (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{'≈'} {priceSecondary}</div>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
