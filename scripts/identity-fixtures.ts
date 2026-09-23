import assert from "node:assert/strict"
import { buildComparisonGroups, buildIdentity, identityMatches, type CanonicalIdentity } from "../lib/comparison.ts"
import type { LigaCard } from "../lib/liga"
import type { TCGPlayerCard } from "../lib/tcgplayer"

const tcg = (name: string, number: string, setName = "OP01") => ({ productId: Math.random(), name, cleanName: name, imageUrl: "", categoryId: 1, groupId: 1, groupName: setName, setName, setCode: "OP01", url: "", price: { productId: 1, lowPrice: 1, midPrice: 1, highPrice: 1, marketPrice: 1, directLowPrice: 1, subTypeName: "Normal" }, extendedData: [{ name: "Number", displayName: "Number", value: number }] }) as unknown as TCGPlayerCard
const liga = (name: string, number: string, set = "OP01") => ({ name, price: 5, numericCode: number, currency: "BRL", url: "", set }) as LigaCard

const exact = buildComparisonGroups([tcg("Monkey D. Luffy OP01-025", "OP01-025")], [liga("Monkey D. Luffy", "OP01-025")])
assert.equal(exact[0]?.matchStatus, "exact")
assert.equal(exact[0]?.matchType, "comparison")
assert.ok(exact[0]?.evidence.some((item) => item.includes("Exact code OP01-025")))

const differentVariant = buildComparisonGroups([tcg("Monkey D. Luffy OP01-025 (Alternate Art)", "OP01-025")], [liga("Monkey D. Luffy", "OP01-025")])
assert.equal(differentVariant[0]?.matchStatus, "ambiguous")
assert.equal(differentVariant[0]?.matchType, "solo")
assert.ok(differentVariant[0]?.evidence.some((item) => item.includes("Variants differ")))

const promoVsBase = buildComparisonGroups([tcg("Monkey D. Luffy OP01-025 Promo", "OP01-025")], [liga("Monkey D. Luffy", "OP01-025")])
assert.equal(promoVsBase[0]?.matchStatus, "ambiguous")
assert.ok(promoVsBase[0]?.evidence.includes("Promo marker retained"))

const reprint = buildIdentity("OP01-025-RE", "Monkey D. Luffy reprint", "OP01")
assert.equal(reprint.variant, "reprint")
assert.ok(reprint.markers.includes("reprint"))

const missingCode = buildComparisonGroups([tcg("Monkey D. Luffy", "")], [liga("Monkey D. Luffy", "OP01-025")])
assert.equal(missingCode[0]?.matchStatus, "ambiguous")
assert.ok(missingCode[0]?.evidence.some((item) => item.includes("missing")))

const similarNames = buildComparisonGroups([tcg("Monkey D. Luffy OP01-025", "OP01-025")], [liga("Monkey D. Luffy OP02-001", "OP02-001")])
assert.equal(similarNames.length, 2)
assert.ok(similarNames.every((group) => group.matchStatus === "unmatched"))

const incomplete: CanonicalIdentity = { game: "one-piece", setCode: "OP01", cardNumber: "025", variant: null, markers: [], language: null, printing: null }
assert.equal(identityMatches(incomplete, incomplete), false)

const unknownVariant = buildIdentity("OP01-025-XYZ", "Monkey D. Luffy", "OP01")
assert.equal(unknownVariant.variant, "unknown")
assert.equal(identityMatches(unknownVariant, unknownVariant), false)
const unknownVariantGroups = buildComparisonGroups([tcg("Monkey D. Luffy OP01-025-XYZ", "OP01-025-XYZ")], [liga("Monkey D. Luffy", "OP01-025-XYZ")])
assert.equal(unknownVariantGroups[0]?.matchStatus, "ambiguous")
assert.equal(unknownVariantGroups[0]?.matchType, "solo")

for (const baseCode of ["P-001", "DON-001"]) {
  const base = buildIdentity(baseCode, "", "")
  assert.deepEqual(base, { game: "one-piece", setCode: baseCode.split("-")[0], cardNumber: "001", variant: "base", markers: [], language: null, printing: null })
  assert.equal(identityMatches(base, base), true)
}

for (const [code, setCode] of [["P-001-AA", "P"], ["DON-001-AA", "DON"]] as const) {
  const parsed = buildIdentity(code, "", "")
  assert.equal(parsed.setCode, setCode)
  assert.equal(parsed.cardNumber, "001")
  assert.equal(parsed.variant, "alternate-art")
  assert.ok(parsed.markers.includes("alternate-art"))
}

const fullArtByName = buildIdentity("OP01-025", "Monkey D. Luffy Full Art", "OP01")
const fullArtByCode = buildIdentity("OP01-025-FA", "Monkey D. Luffy", "OP01")
assert.deepEqual(fullArtByName.markers, ["full-art"])
assert.deepEqual(fullArtByCode.markers, ["full-art"])
assert.equal(identityMatches(fullArtByName, fullArtByCode), true)

for (const code of ["OP01-001", "ST01-001", "EB01-001", "PRB01-001"]) {
  const base = buildIdentity(code, "", "")
  assert.equal(identityMatches(base, base), true)
}
for (const [code, marker] of [["OP01-001-AA", "alternate-art"], ["OP01-001-RE", "reprint"], ["OP01-001-MA", "manga"], ["OP01-001-G", "gold/foil"], ["OP01-001-SP", "special"]] as const) {
  assert.ok(buildIdentity(code, "", "").markers.includes(marker))
}

console.log("identity fixtures passed: exact, variant, promo/base, reprint, missing code, similar-name false match, unknown suffix review, P/DON bases, promo suffix parsing, full-art markers, OP/ST/EB/PRB preservation")
