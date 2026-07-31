"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowUpDown,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react"
import { PriceComparison } from "@/components/price-comparison"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { convertUsdToBrl } from "@/lib/comparison"
import { searchLigaOnePiece, type LigaCard, formatLigaPriceWithUSD } from "@/lib/liga"
import { searchTCGPlayer, type TCGPlayerCard } from "@/lib/tcgplayer"

const DEFAULT_EXCHANGE_RATE = 0.19
const RECENT_SEARCHES_KEY = "opc_recent"
const MAX_COMPARISON_RESULTS = 24

type SortDir = "asc" | "desc"

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
  const [tcgSortKey, setTcgSortKey] = useState<"market" | "low" | "high">("market")
  const [tcgSortDir, setTcgSortDir] = useState<SortDir>("asc")
  const [ligaSortDir, setLigaSortDir] = useState<SortDir>("asc")
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [ligaAvailable, setLigaAvailable] = useState(true)
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
      const next = [query, ...current.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 6)
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

      try {
        const response = await fetch("/api/currency/convert?from=BRL&to=USD&amount=1")
        const data = await response.json()
        if (data.rate) setExchangeRate(data.rate)
      } catch {
        setExchangeRate(DEFAULT_EXCHANGE_RATE)
      }

      const searchPromises = [
        searchTCGPlayer(activeQuery)
          .then((response) => {
            setTcgResults(response.results.slice(0, MAX_COMPARISON_RESULTS))
          })
          .catch((error) => {
            console.error("TCGPlayer search error:", error)
            setSearchErrors((current) => ({ ...current, tcg: "Failed to search TCGPlayer" }))
            setTcgResults([])
          }),
        searchLigaOnePiece(activeQuery)
          .then((response) => {
            setLigaResults(response.results.slice(0, MAX_COMPARISON_RESULTS))
            setLigaAvailable(response.available)
            setLigaWarning(response.warning)
            if (response.exchangeRate) setExchangeRate(response.exchangeRate)
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
    setLigaAvailable(true)
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

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-border/60 bg-card/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur xl:p-7">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <button onClick={clearSearch} className="flex items-center gap-4 text-left">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-black/20 shadow-[0_0_24px_rgba(129,140,248,0.2)]">
                  <img src="/jollylupa.png" alt="BountyDex" className="h-full w-full object-cover" />
                </div>
                <div>
                  <div className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">BountyDex</div>
                  <div className="mt-1 text-sm text-muted-foreground">Live One Piece card price comparison across TCGPlayer and Liga.</div>
                </div>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                  Live rate: 1 USD = R$ {(1 / exchangeRate).toFixed(2)}
                </Badge>
                <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  TCGPlayer + Liga
                </Badge>
              </div>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by card name, code, or character"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 rounded-2xl border-border/60 bg-background/70 pl-11 pr-10 text-sm shadow-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" disabled={isSearching || !searchQuery.trim()} className="h-12 rounded-2xl px-6 font-semibold">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>

            {recentSearches.length > 0 && !hasSearched && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {recentSearches.map((query) => (
                  <button
                    key={query}
                    type="button"
                    onClick={() => void handleSearch(undefined, query)}
                    className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                  >
                    {query}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {!hasSearched ? (
          <section className="grid flex-1 gap-4 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-[28px] border border-border/60 bg-card/55 p-8 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
              <div className="max-w-xl">
                <div className="mb-4 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                  One Piece price comparison
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Find the cheaper listing fast.</h1>
                <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                  Search once and compare TCGPlayer market prices against Liga listings in a compact side-by-side view.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <FeatureCard icon={<Sparkles className="h-5 w-5" />} title="Better matches" description="Comparison runs on a trimmed result set so broad searches stay fast and cheaper to verify." />
              <FeatureCard icon={<RefreshCw className="h-5 w-5" />} title="Live conversion" description="TCGPlayer prices are translated into BRL so local comparisons stay practical." />
              <FeatureCard icon={<TrendingDown className="h-5 w-5" />} title="Cheaper first" description="See likely savings quickly without digging through noisy results." />
            </div>
          </section>
        ) : (
          <>
            <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Results for</div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{searchQuery}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {totalResults} comparison results loaded
                </Badge>
                {ligaResults.length > 0 && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs text-emerald-300">
                    {ligaResults.length} Liga matches
                  </Badge>
                )}
                {!ligaAvailable && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs text-amber-300">
                    {ligaWarning ?? "Liga unavailable"}
                  </Badge>
                )}
              </div>
            </section>

            {isSearching ? (
              <SearchLoading />
            ) : (
              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="grid h-12 w-full grid-cols-3 rounded-2xl border border-border/60 bg-card/60 p-1">
                  <TabsTrigger value="comparison" className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Comparison
                  </TabsTrigger>
                  <TabsTrigger value="tcgplayer" className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    TCGPlayer
                    {tcgResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 border-none bg-background/60 px-1.5 py-0 text-[10px]">
                        {tcgResults.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="liga" className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Liga
                    {ligaResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 border-none bg-background/60 px-1.5 py-0 text-[10px]">
                        {ligaResults.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comparison" className="mt-6">
                  {ligaResults.length > 0 ? (
                    <PriceComparison tcgResults={tcgResults} ligaResults={ligaResults} exchangeRate={exchangeRate || DEFAULT_EXCHANGE_RATE} />
                  ) : (
                    <EmptyState
                      message="Liga results are unavailable right now"
                      detail={
                        ligaWarning ??
                        (searchErrors.liga
                          ? "Liga search failed while fetching comparison data."
                          : "Try another search term or use the TCGPlayer tab for raw results.")
                      }
                    />
                  )}
                </TabsContent>

                <TabsContent value="tcgplayer" className="mt-6">
                  {searchErrors.tcg ? (
                    <SearchError message={searchErrors.tcg} />
                  ) : sortedTcg.length > 0 ? (
                    <section>
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Sort by:</span>
                        {(["market", "low", "high"] as const).map((key) => (
                          <button
                            key={key}
                            onClick={() => setTcgSortKey(key)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              tcgSortKey === key
                                ? "bg-primary text-primary-foreground"
                                : "border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {key === "market" ? "Market" : key === "low" ? "Low" : "High"}
                          </button>
                        ))}
                        <button
                          onClick={() => setTcgSortDir((current) => (current === "asc" ? "desc" : "asc"))}
                          className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {tcgSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>
                      <ResultsGrid
                        cards={sortedTcg.map((card, index) => (
                          <PriceCard
                            key={card.productId || index}
                            platform="tcg"
                            title={card.name}
                            imageUrl={card.imageUrl}
                            primaryValue={card.price?.marketPrice != null ? `$${card.price.marketPrice.toFixed(2)}` : "N/A"}
                            secondaryValue={card.price?.marketPrice ? `R$ ${convertUsdToBrl(card.price.marketPrice, exchangeRate).toFixed(2)}` : undefined}
                            href={card.url}
                            actionLabel="Open TCGPlayer"
                          />
                        ))}
                      />
                    </section>
                  ) : (
                    <EmptyState message="No results found on TCGPlayer" />
                  )}
                </TabsContent>

                <TabsContent value="liga" className="mt-6">
                  {searchErrors.liga ? (
                    <SearchError message={ligaWarning ?? searchErrors.liga} />
                  ) : sortedLiga.length > 0 ? (
                    <section>
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Sort:</span>
                        <button
                          onClick={() => setLigaSortDir((current) => (current === "asc" ? "desc" : "asc"))}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {ligaSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>
                      <ResultsGrid
                        cards={sortedLiga.map((card, index) => (
                          <PriceCard
                            key={`${card.numericCode}-${index}`}
                            platform="liga"
                            title={card.name}
                            imageUrl={card.imageUrl}
                            primaryValue={formatLigaPriceWithUSD(card.price, card.priceUSD)}
                            href={card.url}
                            actionLabel="Open Liga"
                          />
                        ))}
                      />
                    </section>
                  ) : (
                    <EmptyState message="No results found on Liga One Piece" detail={ligaWarning} />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-card/50 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.16)]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function ResultsGrid({ cards }: { cards: React.ReactNode[] }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards}</div>
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
  href: string
  actionLabel: string
}) {
  const badgeClass = platform === "tcg" ? "platform-tcg" : "platform-liga"

  return (
    <article className="overflow-hidden rounded-[24px] border border-border/60 bg-card/70 shadow-[0_16px_40px_rgba(0,0,0,0.16)] transition hover:border-primary/30 hover:-translate-y-0.5">
      <div className="aspect-[4/3] bg-secondary/20 p-4">
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
          <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground">No image</div>
        )}
      </div>
      <div className="border-t border-border/40 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeClass}`}>{platform === "tcg" ? "TCGPlayer" : "Liga"}</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-foreground">{title}</h3>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-lg font-bold text-foreground">{primaryValue}</div>
            {secondaryValue && <div className="mt-1 text-xs font-medium text-muted-foreground">{secondaryValue}</div>}
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/30 hover:text-primary"
          >
            {actionLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  )
}

function SearchLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
      <p className="mt-6 text-sm font-medium text-foreground">Searching both platforms…</p>
      <p className="mt-1 text-xs text-muted-foreground">This can take a moment depending on the source response time.</p>
    </div>
  )
}

function EmptyLanding() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-border/60 bg-card/20 px-6 py-20 text-center">
      <div className="max-w-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Search className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Search a One Piece card to compare pricing instantly</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Start with a card name, set code, or character. BountyDex will fetch TCGPlayer and Liga listings so you can compare prices faster.
        </p>
      </div>
    </div>
  )
}

function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-border/60 bg-card/35 px-6 py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold text-foreground">{message}</h3>
      {detail && <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{detail}</p>}
    </div>
  )
}

function SearchError({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
      {message}
    </div>
  )
}
