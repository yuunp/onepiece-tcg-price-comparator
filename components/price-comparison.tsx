"use client"

import React, { useMemo } from "react"
import { ExternalLink, Package, TrendingDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"
import { convertUsdToBrl } from "@/lib/comparison"

interface PriceComparisonProps {
  tcgResults: TCGPlayerCard[]
  ligaResults: LigaCard[]
  exchangeRate?: number
}

type Row = {
  id: string
  title: string
  tcgCard?: TCGPlayerCard
  ligaCard?: LigaCard
}

const formatCurrency = (amount: number, currency: "USD" | "BRL") =>
  new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency,
  }).format(amount)

export const PriceComparison = ({ tcgResults, ligaResults, exchangeRate = 0.19 }: PriceComparisonProps) => {
  const rows = useMemo(() => buildRows(tcgResults, ligaResults), [ligaResults, tcgResults])

  const comparedRows = rows.filter((row) => row.tcgCard && row.ligaCard)
  const tcgOnlyRows = rows.filter((row) => row.tcgCard && !row.ligaCard)
  const ligaOnlyRows = rows.filter((row) => row.ligaCard && !row.tcgCard)

  const totalSavings = comparedRows.reduce((sum, row) => {
    const tcgPrice = row.tcgCard?.price?.marketPrice || 0
    const ligaUsd = row.ligaCard ? row.ligaCard.price * exchangeRate : 0
    if (!tcgPrice || !ligaUsd) return sum
    return sum + Math.abs(tcgPrice - ligaUsd)
  }, 0)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard value={comparedRows.length} label="Compared rows" />
        <StatCard value={tcgOnlyRows.length} label="TCG only" />
        <StatCard value={ligaOnlyRows.length} label="Liga only" />
        <StatCard value={formatCurrency(totalSavings, "USD")} label="Visible price spread" />
      </div>

      <Section title="Direct comparison" description="Rows only appear here when both marketplaces have the same visible card title after cleanup.">
        {comparedRows.length ? comparedRows.map((row) => <ComparisonRow key={row.id} row={row} exchangeRate={exchangeRate} />) : <Empty message="No direct title matches found yet." />}
      </Section>

      <Section title="Only on TCGPlayer" description="These cards came back from TCGPlayer but not Liga for this search.">
        {tcgOnlyRows.length ? tcgOnlyRows.map((row) => <ComparisonRow key={row.id} row={row} exchangeRate={exchangeRate} />) : <Empty message="No TCG-only cards." />}
      </Section>

      <Section title="Only on Liga" description="These cards came back from Liga but not TCGPlayer for this search.">
        {ligaOnlyRows.length ? ligaOnlyRows.map((row) => <ComparisonRow key={row.id} row={row} exchangeRate={exchangeRate} />) : <Empty message="No Liga-only cards." />}
      </Section>
    </div>
  )
}

function buildRows(tcgResults: TCGPlayerCard[], ligaResults: LigaCard[]): Row[] {
  const ligaByTitle = new Map<string, LigaCard[]>()
  for (const card of ligaResults) {
    const key = normalizeTitle(card.name)
    const list = ligaByTitle.get(key) || []
    list.push(card)
    ligaByTitle.set(key, list)
  }

  const rows: Row[] = []
  const usedLiga = new Set<string>()

  for (const tcgCard of tcgResults) {
    const key = normalizeTitle(tcgCard.name)
    const ligaMatches = ligaByTitle.get(key) || []
    const ligaCard = ligaMatches.find((candidate, index) => {
      const id = `${key}:${index}`
      return !usedLiga.has(id)
    })

    if (ligaCard) {
      const idx = ligaMatches.indexOf(ligaCard)
      usedLiga.add(`${key}:${idx}`)
      rows.push({
        id: `pair:${key}:${tcgCard.productId}:${idx}`,
        title: cleanupTitle(tcgCard.name),
        tcgCard,
        ligaCard,
      })
    } else {
      rows.push({
        id: `tcg:${tcgCard.productId}`,
        title: cleanupTitle(tcgCard.name),
        tcgCard,
      })
    }
  }

  for (const [key, ligaCardsForTitle] of ligaByTitle.entries()) {
    ligaCardsForTitle.forEach((ligaCard, index) => {
      const marker = `${key}:${index}`
      if (usedLiga.has(marker)) return
      rows.push({
        id: `liga:${marker}`,
        title: cleanupTitle(ligaCard.name),
        ligaCard,
      })
    })
  }

  return rows.sort((a, b) => a.title.localeCompare(b.title))
}

function normalizeTitle(name: string): string {
  return cleanupTitle(name)
    .toLowerCase()
    .replace(/monkey\.d\./g, "luffy")
    .replace(/monkey d luffy/g, "luffy")
    .replace(/\s+/g, " ")
    .trim()
}

function cleanupTitle(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim()
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ComparisonRow({ row, exchangeRate }: { row: Row; exchangeRate: number }) {
  const tcgPrice = row.tcgCard?.price?.marketPrice
  const ligaUsd = row.ligaCard ? row.ligaCard.price * exchangeRate : undefined
  const better = tcgPrice != null && ligaUsd != null ? (tcgPrice < ligaUsd ? "TCGPlayer" : ligaUsd < tcgPrice ? "Liga" : "Tie") : undefined

  return (
    <article className="rounded-[22px] border border-border/60 bg-card/70 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{row.title}</h3>
          {better && (
            <Badge variant="secondary" className="mt-2 rounded-full px-2.5 py-1 text-[11px]">
              Better price: {better}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformCard platform="TCGPlayer" card={row.tcgCard} primaryPrice={tcgPrice != null ? formatCurrency(tcgPrice, "USD") : undefined} secondaryPrice={tcgPrice != null ? formatCurrency(convertUsdToBrl(tcgPrice, exchangeRate), "BRL") : undefined} />
        <PlatformCard platform="Liga" card={row.ligaCard} primaryPrice={row.ligaCard ? formatCurrency(row.ligaCard.price, "BRL") : undefined} secondaryPrice={ligaUsd != null ? formatCurrency(ligaUsd, "USD") : undefined} />
      </div>
    </article>
  )
}

function PlatformCard({
  platform,
  card,
  primaryPrice,
  secondaryPrice,
}: {
  platform: "TCGPlayer" | "Liga"
  card?: TCGPlayerCard | LigaCard
  primaryPrice?: string
  secondaryPrice?: string
}) {
  if (!card) {
    return <Empty message={`No ${platform} result for this row.`} />
  }

  const imageUrl = "imageUrl" in card ? card.imageUrl : undefined
  const href = "url" in card ? card.url : undefined
  const subtitle = "groupName" in card ? card.groupName || card.setName : card.set

  return (
    <div className="flex gap-4 rounded-2xl border border-border/50 bg-background/30 p-4">
      <div className="relative h-[100px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl border border-border/50 bg-secondary/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.name}
            className="h-full w-full object-contain"
            onError={(event) => {
              event.currentTarget.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No img</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[10px] font-bold">
            {platform}
          </Badge>
        </div>
        <div className="line-clamp-2 text-sm font-semibold leading-6 text-foreground">{card.name}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
        <div className="mt-auto flex items-end justify-between gap-4 pt-3">
          <div>
            <div className="font-mono text-lg font-bold text-foreground">{primaryPrice ?? "N/A"}</div>
            {secondaryPrice && <div className="mt-1 text-xs text-muted-foreground">≈ {secondaryPrice}</div>}
          </div>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] font-semibold text-foreground transition hover:border-primary/30 hover:text-primary"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-card/60 p-5">
      <div className="font-mono text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">{message}</div>
}
