import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYER_NAMES, validateManifest } from "../src/avatar/manifest";

const conventional = LAYER_NAMES.map((l) => `${l}.png`);

describe("validateManifest", () => {
  it("accepts conventional file names", () => {
    const r = validateManifest({ width: 400, height: 400 }, conventional);
    expect(r.errors).toEqual([]);
    expect(r.manifest?.files.mouth_A).toBe("mouth_A.png");
    expect(r.manifest?.mouthAnchor).toEqual({ x: 200, y: 248 });
  });
  it("reports missing layers and bad sizes", () => {
    const r = validateManifest({ width: -1, height: 400 }, ["base.png"]);
    expect(r.manifest).toBeUndefined();
    expect(r.errors.some((e) => e.includes("width"))).toBe(true);
    expect(r.errors.some((e) => e.includes("mouth_O"))).toBe(true);
  });
  it("treats eyes_half as optional", () => {
    const r = validateManifest({ width: 1, height: 1 }, conventional.filter((f) => f !== "eyes_half.png"));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it("resolves explicit layers case-insensitively", () => {
    const r = validateManifest({ width: 1, height: 1, layers: { base: "Face.PNG" } }, ["face.png", ...conventional.slice(1)]);
    expect(r.manifest?.files.base).toBe("face.png");
  });
  it("rejects bad points", () => {
    const r = validateManifest({ width: 1, height: 1, pivot: { x: "a" } }, conventional);
    expect(r.errors[0]).toContain("pivot");
  });
  it("accepts the built-in avatar", () => {
    const dir = new URL("../public/avatars/default/", import.meta.url);
    const json = JSON.parse(readFileSync(new URL("avatar.json", dir), "utf8"));
    const r = validateManifest(json, readdirSync(dir));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
