"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  ExternalLink,
  Loader2,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ArrowRight,
  Layers,
  RefreshCw,
  TrendingDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { searchTCGPlayer, type TCGPlayerCard } from "@/lib/tcgplayer"
import { searchLigaOnePiece, type LigaCard, formatLigaPriceWithUSD } from "@/lib/liga"
import { PriceComparison } from "@/components/price-comparison"

export default function OnePieceComparator() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [tcgResults, setTcgResults] = useState<TCGPlayerCard[]>([])
  const [ligaResults, setLigaResults] = useState<LigaCard[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchErrors, setSearchErrors] = useState<{ tcg?: string; liga?: string }>({})
  const [exchangeRate, setExchangeRate] = useState<number>(0.19)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  type SortDir = "asc" | "desc"
  const [tcgSortKey, setTcgSortKey] = useState<"market" | "low" | "high">("market")
  const [tcgSortDir, setTcgSortDir] = useState<SortDir>("asc")
  const [ligaSortDir, setLigaSortDir] = useState<SortDir>("asc")
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const convertUSDToBRL = (usdPrice: number): number => {
    return usdPrice / exchangeRate
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("opc_recent")
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch {}
    }
  }, [])

  const pushRecent = useCallback((q: string) => {
    if (!q.trim()) return
    const next = [q, ...recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8)
    setRecentSearches(next)
    if (typeof window !== "undefined") localStorage.setItem("opc_recent", JSON.stringify(next))
  }, [recentSearches])

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setHasSearched(true)
    setSearchErrors({})

    try {
      const response = await fetch("/api/currency/convert?from=BRL&to=USD&amount=1")
      const data = await response.json()
      if (data.rate) setExchangeRate(data.rate)
    } catch {
      // fallback rate
    }

    const searchPromises = [
      searchTCGPlayer(searchQuery)
        .then((response) => {
          setTcgResults(response.results)
        })
        .catch((error) => {
          console.error("TCGPlayer search error:", error)
          setSearchErrors((prev) => ({ ...prev, tcg: "Failed to search TCGPlayer" }))
          setTcgResults([])
        }),

      searchLigaOnePiece(searchQuery)
        .then((response) => {
          setLigaResults(response.results)
          if (response.exchangeRate) setExchangeRate(response.exchangeRate)
        })
        .catch((error) => {
          console.error("Liga search error:", error)
          setSearchErrors((prev) => ({ ...prev, liga: "Failed to search Liga One Piece" }))
          setLigaResults([])
        }),
    ]

    try {
      await Promise.allSettled(searchPromises)
      pushRecent(searchQuery)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, pushRecent])

  const clearSearch = () => {
    setSearchQuery("")
    setHasSearched(false)
    setTcgResults([])
    setLigaResults([])
    setSearchErrors({})
  }

  const sortedTcg = useMemo(() => {
    const mapKey = (c: TCGPlayerCard) => {
      const p = c.price
      if (!p) return Number.POSITIVE_INFINITY
      const val = tcgSortKey === "market" ? p.marketPrice : tcgSortKey === "low" ? p.lowPrice : p.highPrice
      return typeof val === "number" ? val : Number.POSITIVE_INFINITY
    }
    const arr = [...tcgResults].sort((a, b) => {
      const va = mapKey(a)
      const vb = mapKey(b)
      return tcgSortDir === "asc" ? va - vb : vb - va
    })
    return arr
  }, [tcgResults, tcgSortKey, tcgSortDir])

  const sortedLiga = useMemo(() => {
    const arr = [...ligaResults].sort((a, b) => {
      const va = a.price ?? Number.POSITIVE_INFINITY
      const vb = b.price ?? Number.POSITIVE_INFINITY
      return ligaSortDir === "asc" ? va - vb : vb - va
    })
    return arr
  }, [ligaResults, ligaSortDir])

  const totalResults = tcgResults.length + ligaResults.length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ========== NAVBAR ========== */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-5">
          <button onClick={clearSearch} className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
              <img src="/jollylupa.png" alt="One Piece Compare logo" className="h-full w-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <span className="text-base font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                One Piece Compare
              </span>
            </div>
          </button>

          <div className="flex items-center gap-4">
            {hasSearched && (
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                <span className="font-mono">1 USD = R$ {(1 / exchangeRate).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="hidden sm:inline">Live</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ========== HERO / LANDING ========== */}
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center px-5 py-20 md:py-32">
            <div className="w-full max-w-xl animate-fade-up">
              {/* Logo mark */}
              <div className="flex justify-center mb-10">
                <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-lg border border-border">
                  <img src="/jollylupa.png" alt="Logo" className="h-full w-full object-cover" />
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-center text-foreground tracking-tight leading-tight text-balance">
                Compare card prices
                <br />
                <span className="text-primary">across platforms</span>
              </h1>

              <p className="text-center text-secondary-foreground mt-4 text-base leading-relaxed max-w-md mx-auto">
                Search TCGPlayer and Liga One Piece at once.
                Find the best price for any One Piece TCG card.
              </p>

              {/* Search */}
              <form onSubmit={handleSearch} className="mt-10">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Card name or code (e.g. Luffy, OP06-001)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 pl-11 pr-10 text-sm bg-card border-border rounded-xl focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary placeholder:text-muted-foreground"
                    />
                    {!!searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-12 px-6 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2">Search <ArrowRight className="h-4 w-4" /></span>}
                  </Button>
                </div>
              </form>

              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 justify-center items-center">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {recentSearches.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setSearchQuery(q); setTimeout(() => handleSearch(), 0) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3 mt-16 justify-center stagger">
              {[
                { icon: Layers, label: "Multi-platform search" },
                { icon: TrendingDown, label: "Best price matching" },
                { icon: RefreshCw, label: "Real-time BRL/USD rates" },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card border border-border text-sm text-secondary-foreground"
                >
                  <f.icon className="h-4 w-4 text-primary" />
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ========== RESULTS ========== */
          <div className="max-w-6xl mx-auto px-5 py-8">
            {/* Inline search bar */}
            <form onSubmit={handleSearch} className="mb-8">
              <div className="flex items-center gap-2 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 pl-10 pr-10 text-sm bg-card border-border rounded-xl focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                  />
                  {!!searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="h-11 px-5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>
            </form>

            {/* Breadcrumb + summary */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2" aria-label="Breadcrumb">
                  <button onClick={clearSearch} className="hover:text-primary transition-colors">Home</button>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">{searchQuery}</span>
                </nav>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {isSearching ? "Searching..." : `${totalResults} results`}
                </h2>
              </div>

              {!isSearching && (
                <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg border border-border">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center justify-center h-8 w-8 rounded-md transition-all ${viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="sr-only">Grid view</span>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center justify-center h-8 w-8 rounded-md transition-all ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <List className="h-4 w-4" />
                    <span className="sr-only">List view</span>
                  </button>
                </div>
              )}
            </div>

            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground mt-6">Searching both platforms...</p>
                <p className="text-xs text-muted-foreground mt-1">Comparing prices in real-time</p>
              </div>
            ) : (
              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="w-full grid grid-cols-3 h-12 bg-card border border-border rounded-xl p-1">
                  <TabsTrigger
                    value="comparison"
                    className="rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
                  >
                    Comparison
                  </TabsTrigger>
                  <TabsTrigger
                    value="tcgplayer"
                    className="rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
                  >
                    TCGPlayer
                    {tcgResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-5">{tcgResults.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="liga"
                    className="rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
                  >
                    Liga
                    {ligaResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-5">{ligaResults.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* COMPARISON TAB */}
                <TabsContent value="comparison" className="mt-8">
                  <PriceComparison
                    tcgResults={tcgResults}
                    ligaResults={ligaResults}
                    exchangeRate={exchangeRate || undefined}
                  />
                </TabsContent>

                {/* TCGPLAYER TAB */}
                <TabsContent value="tcgplayer" className="mt-8">
                  {searchErrors.tcg ? (
                    <div className="flex items-center justify-center py-20 text-destructive gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm">{searchErrors.tcg}</p>
                    </div>
                  ) : sortedTcg.length > 0 ? (
                    <>
                      {/* Sort controls */}
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <span className="text-xs text-muted-foreground font-medium">Sort by:</span>
                        {(["market", "low", "high"] as const).map((key) => (
                          <button
                            key={key}
                            onClick={() => setTcgSortKey(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              tcgSortKey === key
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-secondary text-secondary-foreground hover:text-foreground border border-border"
                            }`}
                          >
                            {key === "market" ? "Market" : key === "low" ? "Low" : "High"}
                          </button>
                        ))}
                        <button
                          onClick={() => setTcgSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:text-foreground border border-border transition-all flex items-center gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {tcgSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}>
                        {sortedTcg.map((card) => (
                          <div
                            key={card.productId}
                            className="bg-card border border-border rounded-xl overflow-hidden card-hover group"
                          >
                            <div className="aspect-[3/4] bg-secondary relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">No image</span>
                                </div>
                              )}
                              <span className="absolute top-3 right-3 platform-tcg text-[10px] font-bold px-2.5 py-1 rounded-full border">
                                TCGPlayer
                              </span>
                            </div>
                            <div className="p-4">
                              <h4 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 mb-3">{card.name}</h4>
                              {card.price && (
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-muted-foreground">Market</span>
                                  <div className="text-right">
                                    <span className="text-lg font-bold text-foreground font-mono">
                                      ${card.price.marketPrice?.toFixed(2) || "N/A"}
                                    </span>
                                    {card.price.marketPrice && (
                                      <p className="text-[11px] text-muted-foreground font-mono">
                                        R$ {convertUSDToBRL(card.price.marketPrice).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              <a
                                href={card.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 flex items-center justify-center gap-2 w-full h-9 rounded-lg text-xs font-semibold border border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                              >
                                View on TCGPlayer
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState message="No results found on TCGPlayer" />
                  )}
                </TabsContent>

                {/* LIGA TAB */}
                <TabsContent value="liga" className="mt-8">
                  {searchErrors.liga ? (
                    <div className="flex items-center justify-center py-20 text-destructive gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm">{searchErrors.liga}</p>
                    </div>
                  ) : sortedLiga.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <span className="text-xs text-muted-foreground font-medium">Sort:</span>
                        <button
                          onClick={() => setLigaSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground transition-all flex items-center gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {ligaSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}>
                        {sortedLiga.map((card, index) => (
                          <div
                            key={index}
                            className="bg-card border border-border rounded-xl overflow-hidden card-hover group"
                          >
                            <div className="aspect-[3/4] bg-secondary relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">No image</span>
                                </div>
                              )}
                              <span className="absolute top-3 right-3 platform-liga text-[10px] font-bold px-2.5 py-1 rounded-full border">
                                Liga One Piece
                              </span>
                            </div>
                            <div className="p-4">
                              <h4 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 mb-3">{card.name}</h4>
                              {card.price > 0 && (
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-muted-foreground">Price</span>
                                  <span className="text-lg font-bold text-foreground font-mono">
                                    {formatLigaPriceWithUSD(card.price, card.priceUSD)}
                                  </span>
                                </div>
                              )}
                              <a
                                href={card.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 flex items-center justify-center gap-2 w-full h-9 rounded-lg text-xs font-semibold border border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                              >
                                View on Liga
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState message="No results found on Liga One Piece" />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => { clearSearch(); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            className="flex items-center gap-2 group"
          >
            <div className="h-6 w-6 rounded-full overflow-hidden border border-border group-hover:border-primary transition-colors">
              <img src="/jollylupa.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              One Piece Compare
            </span>
          </button>
          <p className="text-xs text-muted-foreground">
            Compare card prices across TCGPlayer & Liga One Piece.
          </p>
        </div>
      </footer>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="h-14 w-14 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-4">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  )
}
