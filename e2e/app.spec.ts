import { expect, test } from "@playwright/test";
import { installFakeSpeech } from "./fake-speech";

type Hook = { __talkingAvatar: { renderer: { mouth: { viseme: string; open: number }; fps: number } } };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeSpeech);
  // These tests cover speech and lip-sync; the lighter illustrated avatar keeps timing stable
  await page.addInitScript(() => localStorage.setItem("talking-avatar:settings", JSON.stringify({ avatar: "default" })));
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("Avatar");
});

test("loads and renders the built-in avatar", async ({ page }) => {
  // Canvas has non-transparent pixels once the avatar layers are drawn
  const painted = await page.evaluate(() => {
    const c = document.getElementById("avatar-canvas") as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(c.width / 2, c.height / 2, 1, 1).data;
    return d[3] > 0 && c.width > 0;
  });
  expect(painted).toBe(true);
  await page.locator(".stage").screenshot({ path: "test-results/avatar.png" });
});

test("mouth moves while a browser voice speaks", async ({ page }) => {
  await page.locator("#text").fill("Hello wonderful world. Another sentence here.");
  await page.locator("#speak").click();
  await expect(page.locator("#stop")).toBeEnabled();

  const visemes = await page.evaluate(async () => {
    const r = (window as unknown as Hook).__talkingAvatar.renderer;
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      seen.add(r.mouth.viseme);
      await new Promise((res) => setTimeout(res, 25));
    }
    return [...seen];
  });
  expect(visemes.length).toBeGreaterThan(2);
  await expect(page.locator("#text-backdrop mark")).toHaveText(/Hello wonderful world\.|Another sentence here\./);
  await expect(page.locator("#speak")).toBeEnabled({ timeout: 10_000 });
});

test("manual viseme buttons override the mouth", async ({ page }) => {
  await page.locator(".debug summary").click();
  for (const v of ["A", "I", "U", "E", "O", "X"]) {
    await page.locator("#viseme-buttons button", { hasText: new RegExp(`^${v}$`) }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Hook).__talkingAvatar.renderer.mouth.viseme)).toBe(v);
  }
});

test("export produces a non-empty video", async ({ page }) => {
  await page.locator("#text").fill("Short clip.");
  const download = page.waitForEvent("download");
  await page.locator("#record").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^avatar-.*\.(webm|mp4)$/);
  const path = await file.path();
  const { statSync } = await import("node:fs");
  expect(statSync(path).size).toBeGreaterThan(1000);
});

test("rejects an invalid avatar zip with a message", async ({ page }) => {
  await page.locator("#avatar-zip").setInputFiles({ name: "bad.zip", mimeType: "application/zip", buffer: Buffer.from("nope") });
  await expect(page.locator("#status")).toContainText("not a readable .zip");
});
