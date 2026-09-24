import { describe, expect, it } from "vitest";
import { AttackRelease, gateAndScale } from "../src/lipsync/smoothing";

describe("AttackRelease", () => {
  it("rises faster than it falls", () => {
    const up = new AttackRelease(0.04, 0.12);
    up.update(1, 0.04);
    const down = new AttackRelease(0.04, 0.12);
    down.value = 1;
    down.update(0, 0.04);
    expect(up.value).toBeGreaterThan(1 - down.value);
  });
  it("converges to the target", () => {
    const f = new AttackRelease();
    for (let i = 0; i < 100; i++) f.update(0.7, 1 / 60);
    expect(f.value).toBeCloseTo(0.7, 3);
  });
});

describe("gateAndScale", () => {
  it("gates noise and clamps", () => {
    expect(gateAndScale(0.005)).toBe(0);
    expect(gateAndScale(1)).toBe(1);
    expect(gateAndScale(0.1)).toBeGreaterThan(0);
  });
});
