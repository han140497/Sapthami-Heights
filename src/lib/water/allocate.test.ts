import { describe, it, expect } from "vitest";
import {
  computeWaterPeriod,
  WaterAllocationError,
  type FlatConsumptionInput,
  type WaterPurchaseInput,
} from "./allocate";

const sumAllocated = (r: ReturnType<typeof computeWaterPeriod>) =>
  r.allocations.reduce((acc, a) => acc + a.amountPaise, 0);

/** A realistic month: one Manjeera bill plus two tankers. */
const realisticPurchases: WaterPurchaseInput[] = [
  { sourceType: "manjeera", litres: 400_000, amountPaise: 3_200_000 }, // ₹32,000 @ 0.08/L
  { sourceType: "tanker", litres: 60_000, amountPaise: 1_080_000 }, // ₹10,800 @ 0.18/L
  { sourceType: "tanker", litres: 40_000, amountPaise: 720_000 }, // ₹7,200 @ 0.18/L
];

/** The real building: A block 20 flats (4/floor across G–4, floor 4 = penthouses),
 *  B block 16 flats (4/floor across 1–4) + 1 penthouse. Total 37. */
function buildingFlats(): string[] {
  const flats: string[] = [];
  for (const floor of ["G", "1", "2", "3", "4"]) {
    for (let n = 1; n <= 4; n++) flats.push(`A-${floor}0${n}`);
  }
  for (const floor of ["1", "2", "3", "4"]) {
    for (let n = 1; n <= 4; n++) flats.push(`B-${floor}0${n}`);
  }
  flats.push("B-PH01");
  return flats;
}

describe("building shape", () => {
  it("is 37 flats: 20 in A, 16 in B, 1 penthouse", () => {
    const flats = buildingFlats();
    expect(flats).toHaveLength(37);
    expect(flats.filter((f) => f.startsWith("A-"))).toHaveLength(20);
    expect(flats.filter((f) => f.startsWith("B-") && f !== "B-PH01")).toHaveLength(16);
    expect(flats).toContain("B-PH01");
  });
});

describe("the sum invariant", () => {
  it("allocates the exact total across 37 flats with awkward consumption", () => {
    // 7 litres each: 37 * 7 = 259 litres into ₹50,000.03 — division is nowhere near clean.
    const consumptions = buildingFlats().map((flatId) => ({ flatId, consumptionLitres: 7 }));
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 259, amountPaise: 5_000_003 }],
      consumptions,
    );
    expect(sumAllocated(result)).toBe(5_000_003);
  });

  it("holds across 2000 randomised months (fuzz)", () => {
    // Deterministic PRNG so a failure is reproducible rather than a heisenbug.
    let seed = 0x5eed_1234;
    const rand = (n: number) => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % n;
    };

    for (let iteration = 0; iteration < 2000; iteration++) {
      const flatCount = 1 + rand(40);
      const consumptions: FlatConsumptionInput[] = Array.from({ length: flatCount }, (_, i) => ({
        flatId: `F-${String(i).padStart(3, "0")}`,
        consumptionLitres: rand(50_000),
      }));
      const purchases: WaterPurchaseInput[] = Array.from({ length: 1 + rand(5) }, () => ({
        sourceType: rand(2) === 0 ? ("manjeera" as const) : ("tanker" as const),
        litres: 1 + rand(500_000),
        amountPaise: rand(10_000_000),
      }));

      const metered = consumptions.reduce((a, c) => a + c.consumptionLitres, 0);
      const totalCost = purchases.reduce((a, p) => a + p.amountPaise, 0);
      if (metered === 0 && totalCost > 0) continue; // legitimately refused, covered separately

      const result = computeWaterPeriod(purchases, consumptions);
      expect(sumAllocated(result)).toBe(totalCost);

      // No flat is ever billed for water it did not consume.
      for (const a of result.allocations) {
        if (a.consumptionLitres === 0) expect(a.amountPaise).toBe(0);
        expect(a.amountPaise).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is deterministic — same inputs give byte-identical output", () => {
    const consumptions = buildingFlats().map((flatId, i) => ({
      flatId,
      consumptionLitres: 1000 + i * 37,
    }));
    const a = computeWaterPeriod(realisticPurchases, consumptions);
    const b = computeWaterPeriod(realisticPurchases, consumptions);
    expect(a).toStrictEqual(b);
  });
});

describe("fairness edges", () => {
  it("bills a zero-consumption flat nothing, even when residue is being handed out", () => {
    // 3 flats share ₹100.00 but one used nothing. The other two split 100 paise
    // that does not divide evenly, so residue distribution is definitely active.
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 3, amountPaise: 10_000 }],
      [
        { flatId: "A-101", consumptionLitres: 1 },
        { flatId: "A-102", consumptionLitres: 2 },
        { flatId: "A-103", consumptionLitres: 0 },
      ],
    );
    const byFlat = Object.fromEntries(result.allocations.map((a) => [a.flatId, a.amountPaise]));
    expect(byFlat["A-103"]).toBe(0);
    expect(sumAllocated(result)).toBe(10_000);
  });

  it("gives the entire cost to a single flat when it consumed everything", () => {
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 5000, amountPaise: 90_000 }],
      [
        { flatId: "A-101", consumptionLitres: 0 },
        { flatId: "B-PH01", consumptionLitres: 4000 },
      ],
    );
    const byFlat = Object.fromEntries(result.allocations.map((a) => [a.flatId, a.amountPaise]));
    expect(byFlat["B-PH01"]).toBe(90_000);
    expect(byFlat["A-101"]).toBe(0);
  });

  it("charges twice the water at twice the price", () => {
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 300, amountPaise: 30_000 }],
      [
        { flatId: "A-101", consumptionLitres: 100 },
        { flatId: "A-102", consumptionLitres: 200 },
      ],
    );
    const byFlat = Object.fromEntries(result.allocations.map((a) => [a.flatId, a.amountPaise]));
    expect(byFlat["A-102"]).toBe(byFlat["A-101"] * 2);
  });

  it("distributes residue by remainder size, not by flat order", () => {
    // ₹1.00 over 3 litres: floors are 33/33/33, residue 1 paisa.
    // Consumption 1/1/1 makes all remainders equal, so the tie breaks on flatId
    // and the first flat alphabetically takes the extra paisa. Deterministic.
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 3, amountPaise: 100 }],
      [
        { flatId: "C-303", consumptionLitres: 1 },
        { flatId: "A-101", consumptionLitres: 1 },
        { flatId: "B-202", consumptionLitres: 1 },
      ],
    );
    const byFlat = Object.fromEntries(result.allocations.map((a) => [a.flatId, a.amountPaise]));
    expect(byFlat["A-101"]).toBe(34);
    expect(byFlat["B-202"]).toBe(33);
    expect(byFlat["C-303"]).toBe(33);
    expect(sumAllocated(result)).toBe(100);
  });
});

describe("single-source months", () => {
  it("handles a tanker-only month", () => {
    const consumptions = buildingFlats().map((flatId) => ({ flatId, consumptionLitres: 3000 }));
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 100_000, amountPaise: 1_800_000 }],
      consumptions,
    );
    expect(sumAllocated(result)).toBe(1_800_000);
    expect(result.bySource).toHaveLength(1);
    expect(result.bySource[0].sourceType).toBe("tanker");
  });

  it("handles a Manjeera-only month", () => {
    const consumptions = buildingFlats().map((flatId) => ({ flatId, consumptionLitres: 3000 }));
    const result = computeWaterPeriod(
      [{ sourceType: "manjeera", litres: 400_000, amountPaise: 3_200_000 }],
      consumptions,
    );
    expect(sumAllocated(result)).toBe(3_200_000);
    expect(result.bySource).toHaveLength(1);
    expect(result.bySource[0].sourceType).toBe("manjeera");
  });

  it("handles a month where no water was bought", () => {
    const consumptions = buildingFlats().map((flatId) => ({ flatId, consumptionLitres: 3000 }));
    const result = computeWaterPeriod([], consumptions);
    expect(sumAllocated(result)).toBe(0);
    expect(result.blendedRatePaisePerLitre).toBe(0);
  });
});

describe("refusing to guess", () => {
  it("throws rather than bill zero when readings are missing but water was bought", () => {
    expect(() =>
      computeWaterPeriod(
        [{ sourceType: "tanker", litres: 5000, amountPaise: 90_000 }],
        buildingFlats().map((flatId) => ({ flatId, consumptionLitres: 0 })),
      ),
    ).toThrow(WaterAllocationError);
  });

  it("rejects negative and fractional inputs", () => {
    const flats = [{ flatId: "A-101", consumptionLitres: 100 }];
    expect(() =>
      computeWaterPeriod([{ sourceType: "tanker", litres: -1, amountPaise: 100 }], flats),
    ).toThrow(WaterAllocationError);
    expect(() =>
      computeWaterPeriod([{ sourceType: "tanker", litres: 10, amountPaise: 10.5 }], flats),
    ).toThrow(WaterAllocationError);
    expect(() =>
      computeWaterPeriod(realisticPurchases, [{ flatId: "A-101", consumptionLitres: -5 }]),
    ).toThrow(WaterAllocationError);
  });

  it("rejects the same flat appearing twice", () => {
    expect(() =>
      computeWaterPeriod(realisticPurchases, [
        { flatId: "A-101", consumptionLitres: 100 },
        { flatId: "A-101", consumptionLitres: 200 },
      ]),
    ).toThrow(/duplicate flat/);
  });
});

describe("transparency figures", () => {
  it("reports the loss gap and the per-source rates residents can check", () => {
    // Bought 500,000 L for ₹50,000. Meters account for 470,000 L across 37 flats:
    // 36 flats at 12,000 L each = 432,000, plus one at 38,000 = 470,000.
    const consumptions = buildingFlats().map((flatId, i) => ({
      flatId,
      consumptionLitres: i === 0 ? 470_000 - 36 * 12_000 : 12_000,
    }));
    const result = computeWaterPeriod(realisticPurchases, consumptions);

    expect(result.totalCostPaise).toBe(5_000_000);
    expect(result.purchasedLitres).toBe(500_000);
    expect(result.meteredLitres).toBe(470_000);
    expect(result.lossLitres).toBe(30_000);
    expect(result.lossPct).toBe(6);

    // Blended rate sits between the cheap municipal water and the costly tankers,
    // and above both because losses are recovered from metered litres.
    expect(result.blendedRatePaisePerLitre).toBeCloseTo(10.638298, 5);

    const manjeera = result.bySource.find((s) => s.sourceType === "manjeera")!;
    const tanker = result.bySource.find((s) => s.sourceType === "tanker")!;
    expect(manjeera.ratePaisePerLitre).toBe(8);
    expect(tanker.ratePaisePerLitre).toBe(18);
    expect(tanker.litres).toBe(100_000); // both tankers rolled together
    expect(tanker.costPaise).toBe(1_800_000);
  });

  it("flags meters reading more than was purchased as a negative gap", () => {
    const result = computeWaterPeriod(
      [{ sourceType: "tanker", litres: 1000, amountPaise: 10_000 }],
      [{ flatId: "A-101", consumptionLitres: 1200 }],
    );
    expect(result.lossLitres).toBe(-200);
    expect(sumAllocated(result)).toBe(10_000);
  });
});
