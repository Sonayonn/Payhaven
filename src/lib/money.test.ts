import { describe, it, expect } from "vitest";
import { usdcToBaseUnits, baseUnitsToUsdc } from "./money";

describe("usdcToBaseUnits", () => {
  it("converts whole USDC", () => {
    expect(usdcToBaseUnits(1)).toBe(1_000_000n);
    expect(usdcToBaseUnits(200)).toBe(200_000_000n);
    expect(usdcToBaseUnits(1500)).toBe(1_500_000_000n);
  });

  it("converts fractional USDC without floating-point loss", () => {
    expect(usdcToBaseUnits(0.5)).toBe(500_000n);
    expect(usdcToBaseUnits(0.1)).toBe(100_000n); // 0.1 is tricky in IEEE 754
    expect(usdcToBaseUnits(0.000001)).toBe(1n); // 1 base unit
    expect(usdcToBaseUnits(0.123456)).toBe(123_456n);
  });

  it("handles zero", () => {
    expect(usdcToBaseUnits(0)).toBe(0n);
  });

  it("rejects negative numbers", () => {
    expect(() => usdcToBaseUnits(-1)).toThrow();
    expect(() => usdcToBaseUnits(-0.5)).toThrow();
  });

  it("rejects NaN and Infinity", () => {
    expect(() => usdcToBaseUnits(NaN)).toThrow();
    expect(() => usdcToBaseUnits(Infinity)).toThrow();
    expect(() => usdcToBaseUnits(-Infinity)).toThrow();
  });

  it("rejects amounts over the MAX_HUMAN_USDC tripwire", () => {
    expect(() => usdcToBaseUnits(1_000_001)).toThrow();
    expect(() => usdcToBaseUnits(1_000_000_000)).toThrow();
  });

  it("accepts the max allowed amount", () => {
    expect(usdcToBaseUnits(1_000_000)).toBe(1_000_000_000_000n);
  });
});

describe("baseUnitsToUsdc", () => {
  it("converts whole base units to USDC", () => {
    expect(baseUnitsToUsdc(1_000_000n)).toBe(1);
    expect(baseUnitsToUsdc(200_000_000n)).toBe(200);
  });

  it("converts fractional base units to USDC", () => {
    expect(baseUnitsToUsdc(500_000n)).toBe(0.5);
    expect(baseUnitsToUsdc(1n)).toBe(0.000001);
    expect(baseUnitsToUsdc(123_456n)).toBe(0.123456);
  });

  it("handles zero", () => {
    expect(baseUnitsToUsdc(0n)).toBe(0);
  });

  it("rejects negative base units", () => {
    expect(() => baseUnitsToUsdc(-1n)).toThrow();
  });
});

describe("round-trip stability", () => {
  it("preserves common amounts through base-units and back", () => {
    const amounts = [0, 1, 200, 1500, 0.5, 0.1, 0.000001, 0.123456];
    for (const amount of amounts) {
      expect(baseUnitsToUsdc(usdcToBaseUnits(amount))).toBe(amount);
    }
  });
});