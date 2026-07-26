"use client"

import React, { useMemo } from "react"
import {
  AlertTriangle,
  CheckCircle,
  Crown,
  ExternalLink,
  Hash,
  Package,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"
import { identifyVariation, matchCards, type CardMatch } from "@/lib/comparison"

interface PriceComparisonProps {
  tcgResults: TCGPlayerCard[]
  ligaResults: LigaCard[]
  exchangeRate?: number
}

const formatCurrency = (amount: number, currency: string = "USD"): string => {
  if (amount == null || Number.isNaN(amount)) return "N/A"
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency === "BRL" ? "BRL" : "USD",
  }).format(amount)
}

export const PriceComparison = ({ tcgResults, ligaResults, exchangeRate = 0.19 }: PriceComparisonProps) => {
  const [sortBy, setSortBy] = React.useState<"savings" | "match" | "price-low" | "price-high">("savings")

  const matches = useMemo(() => {
    if (!tcgResults || !ligaResults) return []
    return matchCards(tcgResults, ligaResults, exchangeRate)
  }, [exchangeRate, ligaResults, tcgResults])

  const sortedMatches = useMemo(() => {
    const sorted = [...matches]
    switch (sortBy) {
      case "savings":
        return sorted.sort((a, b) => (b.savings || 0) - (a.savings || 0))
      case "match":
        return sorted.sort((a, b) => {
          const matchOrder = { perfect: 3, high: 2, medium: 1, none: 0 }
          return matchOrder[b.matchType] - matchOrder[a.matchType]
        })
      case "price-low": {
        return sorted.sort((a, b) => {
          const priceA = Math.min(
            a.tcgCard?.price?.marketPrice || Number.POSITIVE_INFINITY,
            a.ligaCard?.price ? a.ligaCard.price * exchangeRate : Number.POSITIVE_INFINITY,
          )
          const priceB = Math.min(
            b.tcgCard?.price?.marketPrice || Number.POSITIVE_INFINITY,
            b.ligaCard?.price ? b.ligaCard.price * exchangeRate : Number.POSITIVE_INFINITY,
          )
          return priceA - priceB
        })
      }
      case "price-high": {
        return sorted.sort((a, b) => {
          const priceA = Math.max(a.tcgCard?.price?.marketPrice || 0, a.ligaCard?.price ? a.ligaCard.price * exchangeRate : 0)
          const priceB = Math.max(b.tcgCard?.price?.marketPrice || 0, b.ligaCard?.price ? b.ligaCard.price * exchangeRate : 0)
          return priceB - priceA
        })
      }
      default:
        return sorted
    }
  }, [exchangeRate, matches, sortBy])

  const stats = useMemo(
    () => ({
      perfect: matches.filter((match) => match.matchType === "perfect").length,
      high: matches.filter((match) => match.matchType === "high").length,
      medium: matches.filter((match) => match.matchType === "medium").length,
      none: matches.filter((match) => match.matchType === "none").length,
      tcgBetter: matches.filter((match) => match.bestPrice === "tcg" && match.savings && match.savings > 0).length,
      ligaBetter: matches.filter((match) => match.bestPrice === "liga" && match.savings && match.savings > 0).length,
      totalSavings: matches.reduce((sum, match) => sum + (match.savings || 0), 0),
    }),
    [matches],
  )

  if (!tcgResults || !ligaResults) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 stagger">
        <StatCard value={stats.perfect} label="Perfect Matches" icon={<Sparkles className="h-4 w-4" />} color="text-[#34d399]" />
        <StatCard value={stats.high + stats.medium} label="Good Matches" icon={<CheckCircle className="h-4 w-4" />} color="text-[#60a5fa]" />
        <StatCard value={stats.none} label="No Match" icon={<AlertTriangle className="h-4 w-4" />} color="text-muted-foreground" />
        <StatCard value={formatCurrency(stats.totalSavings)} label="Total Potential Savings" icon={<Crown className="h-4 w-4" />} color="text-primary" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sort matches:</span>
        {([
          { key: "savings" as const, label: "Best Deals" },
          { key: "match" as const, label: "Best Match" },
          { key: "price-low" as const, label: "Lowest Price" },
          { key: "price-high" as const, label: "Highest Price" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 ${
              sortBy === key
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(129,140,248,0.3)]"
                : "glass border border-border/50 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {sortedMatches.map((match, index) => {
          const ligaPriceUsd = match.ligaCard?.price ? match.ligaCard.price * exchangeRate : 0
          const ligaVariation = match.ligaCard?.numericCode ? identifyVariation(match.ligaCard.numericCode) : null

          return (
            <div
              key={`${match.tcgCard?.productId || "tcg"}-${match.ligaCard?.numericCode || index}`}
              className={`card-hover overflow-hidden rounded-2xl border glass transition-all duration-300 ${
                match.matchType === "perfect"
                  ? "border-[#34d399]/40 shadow-[0_0_20px_rgba(52,211,153,0.1)]"
                  : match.matchType === "high"
                    ? "border-[#60a5fa]/40 shadow-[0_0_20px_rgba(96,165,250,0.1)]"
                    : match.matchType === "medium"
                      ? "border-primary/40"
                      : "border-border/40"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="p-6">
                <div className="relative grid gap-8 md:grid-cols-2 md:gap-12">
                  <div className="absolute bottom-4 top-4 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border to-transparent md:block" />

                  {match.tcgCard && (
                    <CardSide
                      platform="tcg"
                      name={match.tcgCard.name}
                      imageUrl={match.tcgCard.imageUrl}
                      code={match.tcgCard.extendedData?.find((detail) => detail.name === "Number")?.value || "No Code"}
                      setName={match.tcgCard.groupName || match.tcgCard.setName}
                      price={match.tcgCard.price?.marketPrice != null ? `$${match.tcgCard.price.marketPrice.toFixed(2)}` : "N/A"}
                      url={match.tcgCard.url}
                      isBest={match.bestPrice === "tcg"}
                    />
                  )}

                  {match.ligaCard && (
                    <CardSide
                      platform="liga"
                      name={match.ligaCard.name}
                      imageUrl={match.ligaCard.imageUrl}
                      code={match.ligaCard.numericCode || "No Code"}
                      setName={match.ligaCard.set}
                      variation={ligaVariation?.name !== "Standard" ? ligaVariation?.name : undefined}
                      price={`R$ ${match.ligaCard.price?.toFixed(2) || "N/A"}`}
                      priceSecondary={ligaPriceUsd > 0 ? formatCurrency(ligaPriceUsd) : undefined}
                      url={match.ligaCard.url}
                      isBest={match.bestPrice === "liga"}
                    />
                  )}
                </div>

                <div
                  className={`mt-6 flex flex-col justify-between gap-4 rounded-xl border p-4 backdrop-blur-md sm:flex-row sm:items-center ${
                    match.matchType === "perfect"
                      ? "border-[#34d399]/20 bg-[#34d399]/5"
                      : match.matchType === "high"
                        ? "border-[#60a5fa]/20 bg-[#60a5fa]/5"
                        : match.matchType === "medium"
                          ? "border-primary/20 bg-primary/5"
                          : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <MatchBadge match={match} />
                    {match.matchReasons.length > 0 && match.matchType !== "none" && (
                      <span className="ml-2 hidden text-[11px] font-medium text-muted-foreground/80 sm:inline">{match.matchReasons[0]}</span>
                    )}
                  </div>

                  {match.savings && match.savings > 0 && (
                    <Badge
                      className={`origin-right scale-105 gap-1.5 border-none px-3 py-1 text-xs font-bold ${
                        match.bestPrice === "tcg"
                          ? "bg-[#60a5fa]/15 text-[#60a5fa] shadow-[0_0_10px_rgba(96,165,250,0.2)]"
                          : "bg-[#34d399]/15 text-[#34d399] shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                      }`}
                    >
                      <Crown className="h-3.5 w-3.5" />
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

function MatchBadge({ match }: { match: CardMatch }) {
  if (match.matchType === "perfect") {
    return (
      <Badge className="border-none bg-[#34d399]/10 px-2.5 py-1 text-[12px] font-bold text-[#34d399]">
        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
        Perfect Match ({match.confidenceScore}%)
      </Badge>
    )
  }

  if (match.matchType === "high") {
    return (
      <Badge className="border-none bg-[#60a5fa]/10 px-2.5 py-1 text-[12px] font-bold text-[#60a5fa]">
        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
        Solid Match ({match.confidenceScore}%)
      </Badge>
    )
  }

  if (match.matchType === "medium") {
    return (
      <Badge className="border-none bg-primary/10 px-2.5 py-1 text-[12px] font-bold text-primary">
        <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
        Partial Match ({match.confidenceScore}%)
      </Badge>
    )
  }

  return (
    <Badge className="border-none bg-muted px-2.5 py-1 text-[12px] font-bold text-muted-foreground">
      <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
      No Match Found
    </Badge>
  )
}

function StatCard({ value, label, icon, color }: { value: string | number; label: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass group relative flex items-start justify-between overflow-hidden rounded-2xl border border-border/50 p-5">
      <div className="absolute right-0 top-0 p-4 opacity-10 transition-all duration-500 group-hover:scale-125 group-hover:opacity-20">
        <div className={`h-12 w-12 ${color}`}>{icon}</div>
      </div>
      <div className="relative z-10">
        <div className={`font-mono text-3xl font-extrabold tracking-tight drop-shadow-sm ${color}`}>{value}</div>
        <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
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
    <div className={`group flex gap-5 rounded-xl p-2 transition-all ${isBest ? "-m-2 bg-primary/5" : ""}`}>
      <div className="relative h-[116px] w-[84px] flex-shrink-0 overflow-hidden rounded-xl border border-border/50 bg-secondary/30 shadow-sm">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:scale-[1.05]"
            onError={(event) => {
              event.currentTarget.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-dashed border-border/50 text-[10px] font-medium text-muted-foreground">
            No img
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col pt-1">
        <div className="mb-2 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${platform === "tcg" ? "platform-tcg" : "platform-liga"}`}>
            {platform === "tcg" ? "TCGPlayer" : "Liga One Piece"}
          </span>
          <span className="flex items-center gap-0.5 rounded-md bg-secondary/30 px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
            <Hash className="h-3 w-3 text-muted-foreground/70" />
            {code}
          </span>
        </div>

        <h4 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">{name}</h4>

        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground/80">
          {setName && (
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground/60" />
              {setName}
            </span>
          )}
          {variation && (
            <span className="flex items-center gap-1.5 text-primary drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]">
              <Sparkles className="h-3.5 w-3.5" />
              {variation}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-border/20 pt-3">
          <div>
            <div className={`font-mono text-xl font-extrabold leading-none tracking-tight ${isBest ? "text-primary drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]" : "text-foreground"}`}>
              {price}
            </div>
            {priceSecondary && <div className="mt-1 font-mono text-[12px] font-medium text-muted-foreground/70">≈ {priceSecondary}</div>}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-white/10 hover:text-primary"
          >
            Visit <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
