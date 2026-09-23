"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowUpDown,
  Clock3,
  ExternalLink,
  Grid2x2,
  LayoutList,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { PriceComparison } from "@/components/price-comparison"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { convertUsdToBrl } from "@/lib/comparison"
import { searchLigaOnePiece, type LigaCard, formatBRLPrice } from "@/lib/liga"
import { getSafeSourceUrl } from "@/lib/source-url"
import { searchTCGPlayer, type TCGPlayerCard } from "@/lib/tcgplayer"

const DEFAULT_EXCHANGE_RATE = 0.19
const RECENT_SEARCHES_KEY = "opc_recent"

type SortDir = "asc" | "desc"
type ViewMode = "grid" | "list"

type SearchErrors = {
  tcg?: string
  liga?: string
}

export default function OnePieceComparator() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [tcgResults, setTcgResults] = useState<TCGPlayerCard[]>([])
  const [ligaResults, setLigaResults] = useState<LigaCard[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchErrors, setSearchErrors] = useState<SearchErrors>({})
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE)
  const [exchangeRateStatus, setExchangeRateStatus] = useState<"live" | "fallback" | "unavailable">("fallback")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [tcgSortKey, setTcgSortKey] = useState<"market" | "low" | "high">("market")
  const [tcgSortDir, setTcgSortDir] = useState<SortDir>("asc")
  const [ligaSortDir, setLigaSortDir] = useState<SortDir>("asc")
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [ligaAvailable, setLigaAvailable] = useState<boolean | null>(null)
  const [ligaWarning, setLigaWarning] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (typeof window === "undefined") return

    const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!saved) return

    try {
      setRecentSearches(JSON.parse(saved))
    } catch {
      setRecentSearches([])
    }
  }, [])

  const pushRecent = useCallback((query: string) => {
    if (!query.trim()) return

    setRecentSearches((current) => {
      const next = [query, ...current.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8)
      if (typeof window !== "undefined") {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  const handleSearch = useCallback(
    async (event?: React.FormEvent, forcedQuery?: string) => {
      event?.preventDefault()
      const activeQuery = (forcedQuery ?? searchQuery).trim()
      if (!activeQuery) return

      setSearchQuery(activeQuery)
      setIsSearching(true)
      setHasSearched(true)
      setSearchErrors({})
      setLigaAvailable(null)

      try {
        const response = await fetch("/api/currency/convert?from=BRL&to=USD&amount=1")
        if (!response.ok) throw new Error("Currency conversion failed")
        const data = await response.json()
        if (!Number.isFinite(data.rate) || data.rate <= 0) throw new Error("Currency conversion returned an invalid rate")
        setExchangeRate(data.rate)
        setExchangeRateStatus(data.fallback ? "fallback" : "live")
      } catch {
        setExchangeRate(DEFAULT_EXCHANGE_RATE)
        setExchangeRateStatus("fallback")
      }

      const searchPromises = [
        searchTCGPlayer(activeQuery)
          .then((response) => {
            setTcgResults(response.results)
          })
          .catch((error) => {
            console.error("TCGPlayer search error:", error)
            setSearchErrors((current) => ({ ...current, tcg: "Failed to search TCGPlayer" }))
            setTcgResults([])
          }),
        searchLigaOnePiece(activeQuery)
          .then((response) => {
            setLigaResults(response.results)
            setLigaAvailable(response.available)
            setLigaWarning(response.warning)
            const ligaExchangeRate = response.exchangeRate
            if (typeof ligaExchangeRate === "number" && Number.isFinite(ligaExchangeRate) && ligaExchangeRate > 0) {
              setExchangeRate(ligaExchangeRate)
              setExchangeRateStatus(response.exchangeRateFallback ? "fallback" : "live")
            }
          })
          .catch((error) => {
            console.error("Liga search error:", error)
            setSearchErrors((current) => ({ ...current, liga: "Failed to search Liga One Piece" }))
            setLigaAvailable(false)
            setLigaWarning(undefined)
            setLigaResults([])
          }),
      ]

      try {
        await Promise.allSettled(searchPromises)
        pushRecent(activeQuery)
      } finally {
        setIsSearching(false)
      }
    },
    [pushRecent, searchQuery],
  )

  const clearSearch = useCallback(() => {
    setSearchQuery("")
    setHasSearched(false)
    setTcgResults([])
    setLigaResults([])
    setSearchErrors({})
    setLigaAvailable(null)
    setLigaWarning(undefined)
  }, [])

  const sortedTcg = useMemo(() => {
    const valueFor = (card: TCGPlayerCard) => {
      const price = card.price
      if (!price) return Number.POSITIVE_INFINITY
      const value = tcgSortKey === "market" ? price.marketPrice : tcgSortKey === "low" ? price.lowPrice : price.highPrice
      return typeof value === "number" ? value : Number.POSITIVE_INFINITY
    }

    return [...tcgResults].sort((left, right) => {
      const leftValue = valueFor(left)
      const rightValue = valueFor(right)
      return tcgSortDir === "asc" ? leftValue - rightValue : rightValue - leftValue
    })
  }, [tcgResults, tcgSortDir, tcgSortKey])

  const sortedLiga = useMemo(() => {
    return [...ligaResults].sort((left, right) => {
      const leftValue = left.price ?? Number.POSITIVE_INFINITY
      const rightValue = right.price ?? Number.POSITIVE_INFINITY
      return ligaSortDir === "asc" ? leftValue - rightValue : rightValue - leftValue
    })
  }, [ligaResults, ligaSortDir])

  const totalResults = tcgResults.length + ligaResults.length
  const liveUsdToBrl = exchangeRateStatus === "unavailable" || exchangeRate <= 0 ? 0 : 1 / exchangeRate

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="app-frame mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 sm:px-6 lg:px-8">
        <header className="search-header">
          <button onClick={clearSearch} className="brand" aria-label="BountyDex home">
            <img src="/jollylupa.png" alt="" className="brand-logo" />
            <span>BountyDex <small>One Piece TCG</small></span>
          </button>
          {!hasSearched && <div className="hero-copy">
            <div className="intro-kicker">A card buyer's field guide</div>
            <h1 className="intro-title">Find the card. <em>Read the market.</em></h1>
            <p className="intro-subtitle">BountyDex puts TCGPlayer and Liga One Piece listings side by side, so variants, condition, and source details stay visible before you buy.</p>
          </div>}
          <form onSubmit={handleSearch} className="search-panel">
            <label htmlFor="card-search" className="search-label">Find a card by name or code</label>
            <p id="search-help" className="search-help">Try a character, set, or card code such as OP01-025.</p>
            <div className="search-controls">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="card-search" aria-describedby="search-help" type="text" placeholder="OP01-025 or Monkey D. Luffy" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="search-input" />
                {searchQuery && <button type="button" aria-label="Clear search" onClick={clearSearch} className="clear-search"><X className="h-4 w-4" /></button>}
              </div>
              <Button type="submit" disabled={isSearching || !searchQuery.trim()} className="search-submit">
                {isSearching ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</> : "Search cards"}
              </Button>
            </div>
          </form>
          <div className="market-context">
            <span>TCGPlayer / Liga One Piece</span>
            {hasSearched && <span>{exchangeRateStatus === "live" ? "Live FX" : exchangeRateStatus === "fallback" ? "Fallback FX (estimate)" : "FX unavailable"}: {liveUsdToBrl > 0 ? `1 USD = R$ ${liveUsdToBrl.toFixed(2)}` : "Rate unavailable"}</span>}
          </div>
          {recentSearches.length > 0 && !hasSearched && <div className="recent-searches"><span><Clock3 className="inline h-4 w-4" /> Recent</span>{recentSearches.map((query) => <button key={query} type="button" onClick={() => void handleSearch(undefined, query)}>{query}</button>)}</div>}
        </header>

        {hasSearched && !isSearching && (
          <section className="results-heading">
            <h1>Results for “{searchQuery}”</h1>
            <span>{totalResults} listings returned{ligaAvailable === false ? " · Liga limited" : ""}</span>
          </section>
        )}

        {!hasSearched ? (
          <EmptyLanding />
        ) : isSearching ? (
          <SearchLoading />
        ) : (
          <Tabs defaultValue="comparison" className="w-full gap-5">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-lg border border-white/8 bg-card p-1.5">
              <TabsTrigger value="comparison" className="min-h-[52px] rounded-lg text-sm font-[590] data-[state=active]:bg-card data-[state=active]:text-foreground ">
                Comparison
              </TabsTrigger>
              <TabsTrigger value="tcgplayer" className="min-h-[52px] rounded-lg text-sm font-[590] data-[state=active]:bg-card data-[state=active]:text-foreground ">
                TCGPlayer
                {tcgResults.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full border-none bg-card px-1.5 py-0 text-xs text-foreground">
                    {tcgResults.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="liga" className="min-h-[52px] rounded-lg text-sm font-[590] data-[state=active]:bg-card data-[state=active]:text-foreground ">
                Liga
                {ligaResults.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full border-none bg-card px-1.5 py-0 text-xs text-foreground">
                    {ligaResults.length}
                  </Badge>
                )}
                {ligaAvailable === false && (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full border-none bg-amber-500/10 px-1.5 py-0 text-xs text-amber-300">
                    off
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="mt-0 space-y-4">
              {searchErrors.tcg && <SearchError message={searchErrors.tcg} />}
              {searchErrors.liga && <SearchError message={searchErrors.liga} />}
              {ligaWarning && <p role="status" className="notice">Liga One Piece: {ligaWarning}</p>}
              {ligaAvailable === false && !ligaWarning && <div role="status" className="notice"><strong>Liga One Piece is unavailable for this search.</strong><span className="ml-1">TCGPlayer results remain available in the TCGPlayer tab; comparison will appear when both sources return listings.</span></div>}
              {ligaResults.length > 0 ? (
                <PriceComparison tcgResults={tcgResults} ligaResults={ligaResults} exchangeRate={exchangeRate || DEFAULT_EXCHANGE_RATE} />
              ) : (
                <EmptyState
                  message={ligaAvailable === false ? "Comparison paused: Liga has no returned listings" : searchErrors.liga ? "Comparison unavailable" : "No Liga listings returned"}
                  detail={
                    ligaWarning ??
                    (searchErrors.liga
                      ? "Liga search failed while fetching comparison data."
                      : "Use the TCGPlayer tab to inspect returned listings while the second source is unavailable.")
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="tcgplayer" className="mt-0">
              {searchErrors.tcg ? (
                <SearchError message={searchErrors.tcg} />
              ) : sortedTcg.length > 0 ? (
                <section>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    <span className="text-sm text-muted-foreground">Sort</span>
                    {(["market", "low", "high"] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => setTcgSortKey(key)}
                        aria-pressed={tcgSortKey === key}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          tcgSortKey === key
                            ? "border border-white/10 bg-card text-foreground"
                            : "border border-white/7 bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {key === "market" ? "Market" : key === "low" ? "Low" : "High"}
                      </button>
                    ))}
                    <button
                      onClick={() => setTcgSortDir((current) => (current === "asc" ? "desc" : "asc"))}
                      aria-pressed={tcgSortDir === "desc"}
                      className="flex items-center gap-1.5 rounded-full border border-white/7 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      {tcgSortDir === "asc" ? "Low to High" : "High to Low"}
                    </button>
                  </div>
                  <ResultsGrid
                    viewMode={viewMode}
                    cards={sortedTcg.map((card, index) => (
                      <PriceCard
                        key={card.productId || index}
                        platform="tcg"
                        title={card.name}
                        imageUrl={card.imageUrl}
                        primaryValue={card.price?.marketPrice != null ? `$${card.price.marketPrice.toFixed(2)}` : "N/A"}
                        detail={[card.setName || card.groupName, card.setCode, card.price?.subTypeName].filter(Boolean).join(" · ")}
                        secondaryValue={card.price?.marketPrice ? `≈ R$ ${convertUsdToBrl(card.price.marketPrice, exchangeRate).toFixed(2)}` : undefined}
                        href={getSafeSourceUrl(card.url)}
                        actionLabel="Open source"
                      />
                    ))}
                  />
                </section>
              ) : (
                <EmptyState message="No results found on TCGPlayer" />
              )}
            </TabsContent>

            <TabsContent value="liga" className="mt-0">
              {searchErrors.liga ? (
                <SearchError message={ligaWarning ?? searchErrors.liga} />
              ) : sortedLiga.length > 0 ? (
                <section>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    <span className="text-sm text-muted-foreground">Sort</span>
                    <button
                      onClick={() => setLigaSortDir((current) => (current === "asc" ? "desc" : "asc"))}
                      aria-pressed={ligaSortDir === "desc"}
                      className="flex items-center gap-1.5 rounded-full border border-white/7 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      {ligaSortDir === "asc" ? "Low to High" : "High to Low"}
                    </button>
                  </div>
                  <ResultsGrid
                    viewMode={viewMode}
                    cards={sortedLiga.map((card, index) => (
                      <PriceCard
                        key={`${card.numericCode}-${index}`}
                        platform="liga"
                        title={card.name}
                        imageUrl={card.imageUrl}
                        primaryValue={formatBRLPrice(card.price)}
                        secondaryValue={card.priceUSD != null ? `≈ $${card.priceUSD.toFixed(2)}` : undefined}
                        detail={[card.numericCode, card.set, card.rarity, card.condition].filter(Boolean).join(" · ")}
                        href={getSafeSourceUrl(card.url)}
                        actionLabel="Open source"
                      />
                    ))}
                  />
                </section>
              ) : (
                <EmptyState message="No results found on Liga One Piece" />
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

function ViewToggle({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/8 bg-card p-1">
      <button
        onClick={() => setViewMode("grid")}
        aria-pressed={viewMode === "grid"}
        className={`flex min-h-11 items-center justify-center gap-2 px-3 rounded-full transition ${
          viewMode === "grid" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Grid2x2 className="h-4 w-4" />
        <span>Grid</span>
      </button>
      <button
        onClick={() => setViewMode("list")}
        aria-pressed={viewMode === "list"}
        className={`flex min-h-11 items-center justify-center gap-2 px-3 rounded-full transition ${
          viewMode === "list" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutList className="h-4 w-4" />
        <span>List</span>
      </button>
    </div>
  )
}

function ResultsGrid({ cards, viewMode }: { cards: React.ReactNode[]; viewMode: ViewMode }) {
  return <div className={viewMode === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "results-list flex flex-col gap-3"}>{cards}</div>
}

function PriceCard({
  platform,
  title,
  imageUrl,
  primaryValue,
  secondaryValue,
  href,
  actionLabel,
  detail,
}: {
  platform: "tcg" | "liga"
  title: string
  imageUrl?: string
  primaryValue: string
  secondaryValue?: string
  href: string | null
  actionLabel: string
  detail?: string
}) {
  const badgeClass = platform === "tcg" ? "platform-tcg" : "platform-liga"
  const safeHref = getSafeSourceUrl(href)

  return (
    <article className="price-card">
      <div className="price-card-image">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain"
            onError={(event) => {
              if (!event.currentTarget.src.endsWith("/placeholder.svg")) event.currentTarget.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground">No image</div>
        )}
      </div>
      <div className="price-card-body">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{platform === "tcg" ? "TCGPlayer" : "Liga"}</span>
        </div>
        <h3 className="text-[15px] font-[590] leading-6 tracking-[-0.01em] text-foreground">{title}</h3>
        {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
        <div className="price-actions">
          <div>
            <div className="font-mono text-lg font-bold text-foreground">{primaryValue}</div>
            {secondaryValue && <div className="mt-1 text-xs font-medium text-muted-foreground">{secondaryValue}</div>}
          </div>
          {safeHref ? (
            <a
              aria-label={`Open ${title} on ${platform === "tcg" ? "TCGPlayer" : "Liga"}`}
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-card px-3 py-2 text-sm font-medium uppercase tracking-[0.08em] text-foreground transition hover:bg-card"
            >
              {actionLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="inline-flex items-center rounded-full border border-white/8 px-3 py-2 text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Source unavailable</span>
          )}
        </div>
      </div>
    </article>
  )
}

function SearchLoading() {
  return (
    <div role="status" aria-live="polite" className="empty-panel px-4 py-12">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <p className="text-base font-semibold text-foreground">Checking both marketplaces</p>
      <p className="mt-2 text-sm text-muted-foreground">Listings, variants, and source links are being gathered.</p>
    </div>
  )
}

function SearchError({ message }: { message: string }) {
  return (
    <div role="alert" className="notice flex items-center gap-2 text-destructive">
      <AlertCircle className="h-4 w-4" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function EmptyLanding() {
  return <p className="landing-note">Compare native USD and BRL prices side by side. Check the variant, condition, and final price at the source before buying.</p>
}

function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="empty-panel px-4 py-12">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-white/8 bg-card">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail ?? "Try a broader term or a card code like OP01-025."}</p>
    </div>
  )
}
