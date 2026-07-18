/**
 * Water cost allocation for a billing period.
 *
 * Sapthami Heights draws water from two sources into a common sump: the Manjeera
 * municipal connection and privately bought tankers. Because flats draw from the
 * mixture, no flat can be billed at a single source's rate — the period gets one
 * BLENDED rate per litre.
 *
 * Society policy (chosen by the committee): the blended rate divides total cost by
 * METERED litres, not purchased litres. The society therefore recovers 100% of what
 * it spent on water, and the unaccounted litres (common areas, gardening, leakage,
 * meter drift) are shared across flats in proportion to usage.
 *
 * All arithmetic here is exact integer / BigInt arithmetic. Money never touches a
 * float: `0.1 + 0.2 !== 0.3` has no place in a ledger.
 */

export type WaterSourceType = "manjeera" | "tanker";

export interface WaterPurchaseInput {
  sourceType: WaterSourceType;
  litres: number;
  amountPaise: number;
}

export interface FlatConsumptionInput {
  flatId: string;
  consumptionLitres: number;
}

export interface WaterAllocation {
  flatId: string;
  consumptionLitres: number;
  amountPaise: number;
}

export interface WaterSourceBreakdown {
  sourceType: WaterSourceType;
  litres: number;
  costPaise: number;
  /** Display only, 6dp. Never used to compute money. */
  ratePaisePerLitre: number;
}

export interface WaterPeriodComputation {
  totalCostPaise: number;
  purchasedLitres: number;
  meteredLitres: number;
  /** purchased - metered. Negative means meters recorded more than was bought — suspect readings. */
  lossLitres: number;
  /** Share of purchased litres unaccounted for, 4dp. Display only. */
  lossPct: number;
  /** Display only, 6dp. The per-flat money is computed exactly, not via this. */
  blendedRatePaisePerLitre: number;
  bySource: WaterSourceBreakdown[];
  allocations: WaterAllocation[];
}

export class WaterAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WaterAllocationError";
  }
}

function assertNonNegativeInt(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new WaterAllocationError(`${label} must be an integer, got ${value}`);
  }
  if (value < 0) {
    throw new WaterAllocationError(`${label} must not be negative, got ${value}`);
  }
}

/**
 * Round a ratio to `dp` decimal places for display, without letting float error
 * anywhere near the allocation itself.
 */
function ratioForDisplay(numerator: bigint, denominator: bigint, dp: number): number {
  if (denominator === 0n) return 0;
  const scale = 10n ** BigInt(dp);
  // Round half-up on the scaled integer, then step down to a float exactly once.
  const scaled = (numerator * scale * 2n + denominator) / (denominator * 2n);
  return Number(scaled) / Number(scale);
}

/**
 * Allocate the period's total water cost across flats by metered consumption.
 *
 * Uses the largest-remainder method. Naive per-flat rounding would leave the 37
 * charges summing to a few paise either side of the true bill, which would then
 * fail the ledger's debit=credit check on every single close. Here each flat first
 * takes the floor of its exact share, and the leftover paise are handed one at a
 * time to the flats with the largest fractional remainders. The result sums to
 * `totalCostPaise` exactly, by construction.
 *
 * Ties break on flatId so the outcome is deterministic and reproducible — an
 * auditor re-running this on the same inputs gets byte-identical numbers.
 */
export function computeWaterPeriod(
  purchases: readonly WaterPurchaseInput[],
  consumptions: readonly FlatConsumptionInput[],
): WaterPeriodComputation {
  for (const p of purchases) {
    assertNonNegativeInt(p.litres, `purchase litres (${p.sourceType})`);
    assertNonNegativeInt(p.amountPaise, `purchase amountPaise (${p.sourceType})`);
  }
  for (const c of consumptions) {
    assertNonNegativeInt(c.consumptionLitres, `consumption for flat ${c.flatId}`);
  }

  const seen = new Set<string>();
  for (const c of consumptions) {
    if (seen.has(c.flatId)) {
      throw new WaterAllocationError(`duplicate flat in consumption input: ${c.flatId}`);
    }
    seen.add(c.flatId);
  }

  const totalCost = purchases.reduce((acc, p) => acc + BigInt(p.amountPaise), 0n);
  const purchasedLitres = purchases.reduce((acc, p) => acc + BigInt(p.litres), 0n);
  const meteredLitres = consumptions.reduce((acc, c) => acc + BigInt(c.consumptionLitres), 0n);

  // Cost with no metered litres to divide by is unallocatable. This is a real
  // scenario — readings not yet entered — and it must block the close loudly
  // rather than silently bill everyone zero for water the society paid for.
  if (meteredLitres === 0n && totalCost > 0n) {
    throw new WaterAllocationError(
      "cannot allocate water cost: total metered consumption is zero while " +
        `${totalCost} paise of water was purchased. Enter meter readings before closing.`,
    );
  }

  const allocations: WaterAllocation[] = consumptions.map((c) => ({
    flatId: c.flatId,
    consumptionLitres: c.consumptionLitres,
    amountPaise: 0,
  }));

  if (totalCost > 0n) {
    // floor_i = totalCost * consumption_i / metered, exact integer division.
    // remainder_i = the same division's remainder, kept as an exact integer so
    // ordering by fractional part never depends on float comparison.
    const parts = consumptions.map((c, index) => {
      const numerator = totalCost * BigInt(c.consumptionLitres);
      return {
        index,
        flatId: c.flatId,
        floor: numerator / meteredLitres,
        remainder: numerator % meteredLitres,
      };
    });

    const distributed = parts.reduce((acc, p) => acc + p.floor, 0n);
    let residue = totalCost - distributed;

    // residue is strictly less than the count of flats with a non-zero remainder,
    // and a non-zero remainder implies non-zero consumption. So a flat that used
    // no water can never be handed a residue paisa. Asserted below.
    const candidates = parts
      .filter((p) => p.remainder > 0n)
      .sort((a, b) => {
        if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
        return a.flatId < b.flatId ? -1 : a.flatId > b.flatId ? 1 : 0;
      });

    if (residue > BigInt(candidates.length)) {
      throw new WaterAllocationError(
        `internal: residue ${residue} exceeds ${candidates.length} eligible flats`,
      );
    }

    for (const part of parts) {
      allocations[part.index].amountPaise = Number(part.floor);
    }
    for (const candidate of candidates) {
      if (residue <= 0n) break;
      allocations[candidate.index].amountPaise += 1;
      residue -= 1n;
    }
  }

  // The invariant this whole module exists to guarantee. If it ever fails, we
  // must not hand these numbers to the ledger.
  const allocatedTotal = allocations.reduce((acc, a) => acc + BigInt(a.amountPaise), 0n);
  if (allocatedTotal !== totalCost) {
    throw new WaterAllocationError(
      `internal: allocated ${allocatedTotal} paise but total cost is ${totalCost} paise`,
    );
  }
  for (const a of allocations) {
    if (a.consumptionLitres === 0 && a.amountPaise !== 0) {
      throw new WaterAllocationError(
        `internal: flat ${a.flatId} consumed nothing but was billed ${a.amountPaise} paise`,
      );
    }
  }

  const bySource: WaterSourceBreakdown[] = (["manjeera", "tanker"] as const)
    .map((sourceType) => {
      const rows = purchases.filter((p) => p.sourceType === sourceType);
      const litres = rows.reduce((acc, p) => acc + BigInt(p.litres), 0n);
      const costPaise = rows.reduce((acc, p) => acc + BigInt(p.amountPaise), 0n);
      return {
        sourceType,
        litres: Number(litres),
        costPaise: Number(costPaise),
        ratePaisePerLitre: ratioForDisplay(costPaise, litres, 6),
      };
    })
    .filter((s) => s.litres > 0 || s.costPaise > 0);

  return {
    totalCostPaise: Number(totalCost),
    purchasedLitres: Number(purchasedLitres),
    meteredLitres: Number(meteredLitres),
    lossLitres: Number(purchasedLitres - meteredLitres),
    lossPct: ratioForDisplay((purchasedLitres - meteredLitres) * 100n, purchasedLitres, 4),
    blendedRatePaisePerLitre: ratioForDisplay(totalCost, meteredLitres, 6),
    bySource,
    allocations,
  };
}
