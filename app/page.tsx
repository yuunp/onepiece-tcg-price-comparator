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
import { searchLigaOnePiece, type LigaCard, formatLigaPriceWithUSD } from "@/lib/liga"
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
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-8 flex flex-col gap-6 lg:mb-10">
          <section className="rounded-[30px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <button onClick={clearSearch} className="flex items-center gap-4 text-left">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <img src="/jollylupa.png" alt="BountyDex" className="h-full w-full rounded-[14px] object-cover" />
                  </div>
                  <div>
                    <div className="text-[28px] font-[590] tracking-[-0.03em] text-foreground sm:text-[34px]">BountyDex</div>
                    <div className="mt-1 text-sm text-muted-foreground">One Piece TCG market view</div>
                  </div>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                <DataChip
                  label={exchangeRateStatus === "live" ? "Live FX" : exchangeRateStatus === "fallback" ? "Fallback FX" : "FX unavailable"}
                  value={liveUsdToBrl > 0 ? `1 USD = R$ ${liveUsdToBrl.toFixed(2)}` : "Rate unavailable"}
                  tone={exchangeRateStatus === "live" ? "neutral" : "warning"}
                />
                <DataChip
                  label="Coverage"
                  value={ligaAvailable === null ? "Checking Liga…" : ligaAvailable ? "TCGPlayer + Liga active" : "TCGPlayer active, Liga limited"}
                  tone={ligaAvailable === null ? "neutral" : ligaAvailable ? "success" : "warning"}
                />
              </div>
            </div>

            <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by card name, code, or character"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 rounded-[18px] border-white/10 bg-[rgba(255,255,255,0.025)] pl-11 pr-10 text-sm text-foreground shadow-none placeholder:text-muted-foreground/80"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="h-12 rounded-[18px] border border-[rgba(113,112,255,0.28)] bg-[linear-gradient(180deg,#7170ff_0%,#5e6ad2_100%)] px-6 text-sm font-[590] text-white shadow-[0_12px_30px_rgba(94,106,210,0.35)] hover:brightness-105"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>

            {recentSearches.length > 0 && !hasSearched && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 pr-2 text-[12px] font-medium text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Recent
                </div>
                {recentSearches.map((query) => (
                  <button
                    key={query}
                    type="button"
                    onClick={() => void handleSearch(undefined, query)}
                    className="rounded-full border border-white/8 bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-white/14 hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground"
                  >
                    {query}
                  </button>
                ))}
              </div>
            )}
          </section>

          {!hasSearched && (
            <section className="grid gap-3 md:grid-cols-3">
              <FeatureCard title="Cleaner matches" description="Pairings are grouped by closeness first, so strong matches surface before raw leftovers." />
              <FeatureCard title="Real currency context" description="USD and BRL stay visible together, which makes the spread easier to judge at a glance." />
              <FeatureCard title="Less noise" description="The interface stays focused on search, comparison, and source tabs instead of decorative filler." />
            </section>
          )}
        </header>

        {hasSearched && (
          <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Search</div>
              <h1 className="mt-2 text-[30px] font-[590] tracking-[-0.03em] text-foreground sm:text-[38px]">{searchQuery}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[11px] font-medium text-foreground">
                {totalResults} results
              </Badge>
              {ligaResults.length > 0 && (
                <Badge variant="secondary" className="rounded-full border border-emerald-500/15 bg-emerald-500/8 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  {ligaResults.length} Liga
                </Badge>
              )}
              {ligaAvailable === false && (
                <Badge variant="secondary" className="rounded-full border border-amber-500/15 bg-amber-500/8 px-3 py-1 text-[11px] font-medium text-amber-300">
                  Liga limited
                </Badge>
              )}
              <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
            </div>
          </section>
        )}

        {!hasSearched ? (
          <EmptyLanding />
        ) : isSearching ? (
          <SearchLoading />
        ) : (
          <Tabs defaultValue="comparison" className="w-full gap-5">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-[22px] border border-white/8 bg-[rgba(255,255,255,0.02)] p-1.5">
              <TabsTrigger value="comparison" className="min-h-[52px] rounded-[16px] text-sm font-[590] data-[state=active]:bg-[rgba(255,255,255,0.06)] data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                Comparison
              </TabsTrigger>
              <TabsTrigger value="tcgplayer" className="min-h-[52px] rounded-[16px] text-sm font-[590] data-[state=active]:bg-[rgba(255,255,255,0.06)] data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                TCGPlayer
                {tcgResults.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full border-none bg-[rgba(255,255,255,0.06)] px-1.5 py-0 text-[10px] text-foreground">
                    {tcgResults.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="liga" className="min-h-[52px] rounded-[16px] text-sm font-[590] data-[state=active]:bg-[rgba(255,255,255,0.06)] data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                Liga
                {ligaResults.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full border-none bg-[rgba(255,255,255,0.06)] px-1.5 py-0 text-[10px] text-foreground">
                    {ligaResults.length}
                  </Badge>
                )}
                {ligaAvailable === false && (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full border-none bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-300">
                    off
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="mt-0">
              {ligaResults.length > 0 ? (
                <PriceComparison tcgResults={tcgResults} ligaResults={ligaResults} exchangeRate={exchangeRate || DEFAULT_EXCHANGE_RATE} />
              ) : (
                <EmptyState
                  message="No Liga results available for comparison yet"
                  detail={
                    ligaWarning ??
                    (searchErrors.liga
                      ? "Liga search failed while fetching comparison data."
                      : "Try another search term or open the TCGPlayer tab for raw results.")
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
                    <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Sort</span>
                    {(["market", "low", "high"] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => setTcgSortKey(key)}
                        aria-pressed={tcgSortKey === key}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          tcgSortKey === key
                            ? "border border-white/10 bg-[rgba(255,255,255,0.06)] text-foreground"
                            : "border border-white/7 bg-[rgba(255,255,255,0.02)] text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {key === "market" ? "Market" : key === "low" ? "Low" : "High"}
                      </button>
                    ))}
                    <button
                      onClick={() => setTcgSortDir((current) => (current === "asc" ? "desc" : "asc"))}
                      aria-pressed={tcgSortDir === "desc"}
                      className="flex items-center gap-1.5 rounded-full border border-white/7 bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
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
                        secondaryValue={card.price?.marketPrice ? `R$ ${convertUsdToBrl(card.price.marketPrice, exchangeRate).toFixed(2)}` : undefined}
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
                    <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Sort</span>
                    <button
                      onClick={() => setLigaSortDir((current) => (current === "asc" ? "desc" : "asc"))}
                      aria-pressed={ligaSortDir === "desc"}
                      className="flex items-center gap-1.5 rounded-full border border-white/7 bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
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
                        primaryValue={formatLigaPriceWithUSD(card.price, card.priceUSD)}
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

function DataChip({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "warning" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/12 bg-emerald-500/7 text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/12 bg-amber-500/7 text-amber-300"
        : "border-white/8 bg-[rgba(255,255,255,0.025)] text-foreground"

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.025)] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.015)]">
      <h2 className="text-[15px] font-[590] tracking-[-0.01em] text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function ViewToggle({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/8 bg-[rgba(255,255,255,0.02)] p-1">
      <button
        onClick={() => setViewMode("grid")}
        aria-pressed={viewMode === "grid"}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
          viewMode === "grid" ? "bg-[rgba(255,255,255,0.08)] text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Grid2x2 className="h-4 w-4" />
        <span className="sr-only">Grid view</span>
      </button>
      <button
        onClick={() => setViewMode("list")}
        aria-pressed={viewMode === "list"}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
          viewMode === "list" ? "bg-[rgba(255,255,255,0.08)] text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutList className="h-4 w-4" />
        <span className="sr-only">List view</span>
      </button>
    </div>
  )
}

function ResultsGrid({ cards, viewMode }: { cards: React.ReactNode[]; viewMode: ViewMode }) {
  return <div className={viewMode === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>{cards}</div>
}

function PriceCard({
  platform,
  title,
  imageUrl,
  primaryValue,
  secondaryValue,
  href,
  actionLabel,
}: {
  platform: "tcg" | "liga"
  title: string
  imageUrl?: string
  primaryValue: string
  secondaryValue?: string
  href: string | null
  actionLabel: string
}) {
  const badgeClass = platform === "tcg" ? "platform-tcg" : "platform-liga"
  const safeHref = getSafeSourceUrl(href)

  return (
    <article className="card-hover overflow-hidden rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.025)] shadow-[0_0_0_1px_rgba(255,255,255,0.015),0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="aspect-[4/3] bg-[rgba(255,255,255,0.02)] p-5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain"
            onError={(event) => {
              event.currentTarget.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[18px] border border-dashed border-white/10 text-xs text-muted-foreground">No image</div>
        )}
      </div>
      <div className="border-t border-white/8 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${badgeClass}`}>{platform === "tcg" ? "TCGPlayer" : "Liga"}</span>
        </div>
        <h3 className="line-clamp-2 text-[15px] font-[590] leading-6 tracking-[-0.01em] text-foreground">{title}</h3>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-lg font-bold text-foreground">{primaryValue}</div>
            {secondaryValue && <div className="mt-1 text-xs font-medium text-muted-foreground">{secondaryValue}</div>}
          </div>
          {safeHref ? (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-foreground transition hover:bg-[rgba(255,255,255,0.06)]"
            >
              {actionLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="inline-flex items-center rounded-full border border-white/8 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Source unavailable</span>
          )}
        </div>
      </div>
    </article>
  )
}

function SearchLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center rounded-[30px] border border-white/8 bg-[rgba(255,255,255,0.025)] py-28">
      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/8 bg-[rgba(255,255,255,0.04)]">
        <Loader2 className="h-7 w-7 animate-spin text-[#828fff]" />
      </div>
      <p className="mt-6 text-sm font-medium text-foreground">Searching both platforms</p>
      <p className="mt-1 text-xs text-muted-foreground">Source latency can vary.</p>
    </div>
  )
}

function SearchError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center justify-center gap-2 rounded-[24px] border border-destructive/25 bg-destructive/8 py-8 text-destructive">
      <AlertCircle className="h-4 w-4" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function EmptyLanding() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-[30px] border border-white/8 bg-[rgba(255,255,255,0.02)] px-6 py-24 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="max-w-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/8 bg-[rgba(255,255,255,0.04)] text-[#828fff]">
          <Search className="h-6 w-6" />
        </div>
        <h2 className="text-[28px] font-[590] tracking-[-0.03em] text-foreground sm:text-[36px]">Search a card and compare the market fast</h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-[15px]">
          Start with a card name, code, or character. BountyDex pulls TCGPlayer and Liga into one view so you can judge price spread without bouncing between tabs.
        </p>
      </div>
    </div>
  )
}

function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.02)] py-24">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-[rgba(255,255,255,0.04)]">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail ?? "Try a broader term or a card code like OP01-025."}</p>
    </div>
  )
}
