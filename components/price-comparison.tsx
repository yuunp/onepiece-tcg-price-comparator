"use client"

import React, { useMemo } from "react"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  buildComparisonGroups,
  convertUsdToBrl,
  type CardEntry,
  type ComparisonGroup,
} from "@/lib/comparison"
import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"
import { getSafeSourceUrl } from "@/lib/source-url"

interface PriceComparisonProps {
  tcgResults: TCGPlayerCard[]
  ligaResults: LigaCard[]
  exchangeRate?: number
}

export const PriceComparison = ({ tcgResults, ligaResults, exchangeRate = 0.19 }: PriceComparisonProps) => {
  const groups = useMemo(
    () => buildComparisonGroups(tcgResults, ligaResults, exchangeRate),
    [exchangeRate, ligaResults, tcgResults],
  )
  const comparedGroups = groups.filter((group) => group.matchType === "comparison")
  const unmatchedGroups = groups.filter((group) => group.matchType === "solo")
  const comparedEntries = comparedGroups.reduce((total, group) => total + group.entries.length, 0)
  const tcgOnly = unmatchedGroups.filter((group) => group.tcgEntries.length > 0).length
  const ligaOnly = unmatchedGroups.filter((group) => group.ligaEntries.length > 0).length
  const totalSavings = comparedGroups.reduce((total, group) => total + (group.savings || 0), 0)

  return (
    <div className="space-y-10">
      <div className="stat-strip grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <StatCard value={comparedGroups.length} label="Card identities" />
        <StatCard value={comparedEntries} label="Listings grouped" />
        <StatCard value={tcgOnly + ligaOnly} label="Unmatched" />
        <StatCard value={formatCurrency(totalSavings, "USD")} label="Price difference" />
      </div>

      <GroupSection
        title="Matched card identities"
        description="Listings are grouped by card number. Variants stay visible inside the group."
        groups={comparedGroups}
        exchangeRate={exchangeRate}
        emptyMessage="No exact card-number matches were found. Unmatched listings remain below."
      />

      <GroupSection
        title="Unmatched listings"
        description="No reliable identity counterpart was found on the other marketplace."
        groups={unmatchedGroups}
        exchangeRate={exchangeRate}
        emptyMessage="Every returned listing has a counterpart."
      />
    </div>
  )
}

function GroupSection({
  title,
  description,
  groups,
  exchangeRate,
  emptyMessage,
}: {
  title: string
  description: string
  groups: ComparisonGroup[]
  exchangeRate: number
  emptyMessage: string
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border pb-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground sm:text-right">{description}</p>
      </div>
      <div className="space-y-3">
        {groups.length ? groups.map((group) => <GroupCard key={group.groupKey} group={group} exchangeRate={exchangeRate} />) : <Empty message={emptyMessage} />}
      </div>
    </section>
  )
}

function GroupCard({ group, exchangeRate }: { group: ComparisonGroup; exchangeRate: number }) {
  const identityLabel = group.subtitle || "Identity inferred from name and set"
  const matchLabel = group.matchType === "comparison" ? "Matched by identity" : "No counterpart"

  return (
    <article className="comparison-row rounded-xl p-4 transition-colors sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{group.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{identityLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{group.entries.length} listing{group.entries.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
          {matchLabel}
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MarketplaceColumn label="TCGPlayer" entries={group.tcgEntries} exchangeRate={exchangeRate} />
        <MarketplaceColumn label="Liga" entries={group.ligaEntries} exchangeRate={exchangeRate} />
      </div>
    </article>
  )
}

function MarketplaceColumn({ label, entries, exchangeRate }: { label: string; entries: CardEntry[]; exchangeRate: number }) {
  return (
    <div className="source-card rounded-lg p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className={label === "TCGPlayer" ? "platform-tcg rounded-md px-2 py-1 text-[10px] font-bold" : "platform-liga rounded-md px-2 py-1 text-[10px] font-bold"}>
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{entries.length ? `${entries.length} found` : "Not found"}</span>
      </div>
      {entries.length ? (
        <div className="space-y-3">
          {entries.map((entry) => <Listing entry={entry} exchangeRate={exchangeRate} key={entry.id} />)}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">No reliable match on this marketplace.</div>
      )}
    </div>
  )
}

function Listing({ entry, exchangeRate }: { entry: CardEntry; exchangeRate: number }) {
  const card = entry.tcgCard || entry.ligaCard
  if (!card) return null
  const imageUrl = "imageUrl" in card ? card.imageUrl : undefined
  const href = "url" in card ? getSafeSourceUrl(card.url) : null
  const primaryPrice = entry.platform === "tcg" ? formatCurrency(entry.usdPrice, "USD") : formatCurrency(entry.brlPrice, "BRL")
  const secondaryPrice = entry.platform === "tcg" ? formatCurrency(convertUsdToBrl(entry.usdPrice, exchangeRate), "BRL") : formatCurrency(entry.usdPrice, "USD")
  const variant = entry.variantTokens.length ? entry.variantTokens.join(" · ") : "standard"

  return (
    <div className="flex gap-3">
      <div className="relative h-24 w-[68px] flex-shrink-0 overflow-hidden rounded-md border border-border bg-secondary/30">
        {imageUrl ? (
          <img src={imageUrl} alt={entry.displayName} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.src = "/placeholder.svg" }} />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No image</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{card.name}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{entry.setName || "Set not provided"} · {variant}</div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            <div className="font-mono text-base font-bold text-foreground">{primaryPrice}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">≈ {secondaryPrice}</div>
          </div>
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="quiet-link inline-flex items-center gap-1 border-b border-border px-1 py-1 text-[11px] font-semibold">Open <ExternalLink className="h-3 w-3" /></a>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="font-mono text-xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">{message}</div>
}

function formatCurrency(amount: number, currency: "USD" | "BRL"): string {
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency }).format(amount)
}
