import { expect, test } from "@playwright/test";

// Downloads the real model (~90 MB) — opt-in: KOKORO=1 npx playwright test e2e/kokoro.spec.ts
test.skip(!process.env.KOKORO, "set KOKORO=1 to run the real-model test");
test.setTimeout(600_000);

type Hook = { __talkingAvatar: { renderer: { mouth: { viseme: string; open: number } } } };

test("Kokoro loads, speaks and drives the mouth from audio", async ({ page }) => {
  page.on("console", (m) => m.text().includes("kokoro") && console.log(m.text()));
  await page.goto("/");
  await page.locator('input[value="kokoro"]').check({ force: true });
  await page.locator("#kokoro-load-btn").click();
  await expect(page.locator("#status")).toContainText("Kokoro ready", { timeout: 540_000 });
  console.log(await page.locator("#status").textContent());

  await page.locator("#text").fill("Hello there. My mouth should move with this voice.");
  const t0 = Date.now();
  await page.locator("#speak").click();
  await expect(page.locator("#status")).toContainText("Speaking", { timeout: 60_000 });
  console.log(`first audio after ${Date.now() - t0} ms`);

  const samples = await page.evaluate(async () => {
    const r = (window as unknown as Hook).__talkingAvatar.renderer;
    const out: { v: string; o: number }[] = [];
    for (let i = 0; i < 120; i++) {
      out.push({ v: r.mouth.viseme, o: r.mouth.open });
      await new Promise((res) => setTimeout(res, 25));
    }
    return out;
  });
  const visemes = new Set(samples.map((s) => s.v));
  console.log("visemes", [...visemes].join(","), "max open", Math.max(...samples.map((s) => s.o)).toFixed(2));
  expect(visemes.size).toBeGreaterThan(2);
  expect(samples.some((s) => s.v === "X")).toBe(true);
  await expect(page.locator("#speak")).toBeEnabled({ timeout: 60_000 });
});
