import { expect, test, type Page } from "@playwright/test";
import { installFakeSpeech } from "./fake-speech";

type Hook = { __talkingAvatar: { renderer: { manualViseme: string | null } } };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeSpeech);
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("Sample photo");
});

/** Average RGB of a small square at the mouth centre of the sample photo (886 px wide). */
const mouthPixel = (page: Page) =>
  page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 500));
    const c = document.getElementById("avatar-canvas") as HTMLCanvasElement;
    const k = c.width / 886;
    const d = c.getContext("2d")!.getImageData(466 * k, 530 * k, 6, 6).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4);
  });

test("the sample photo opens its mouth", async ({ page }) => {
  await page.evaluate(() => ((window as unknown as Hook).__talkingAvatar.renderer.manualViseme = "X"));
  const closed = await mouthPixel(page);
  await page.evaluate(() => ((window as unknown as Hook).__talkingAvatar.renderer.manualViseme = "A"));
  const open = await mouthPixel(page);
  // The inside of the mouth is much darker than the lips
  expect(open).toBeLessThan(closed * 0.7);
  await page.locator(".stage").screenshot({ path: "test-results/photo-open.png" });
});

test("an uploaded photo can have its mouth marked by hand", async ({ page }) => {
  // Without the detector the app falls back to manual marking
  await page.route(/jsdelivr|mediapipe-models/, (r) => r.abort());
  await page.locator("#avatar-photo").setInputFiles("public/avatars/sample-photo/face.png");
  await expect(page.locator("#status")).toContainText("LEFT corner", { timeout: 15_000 });

  const box = (await page.locator("#avatar-canvas").boundingBox())!;
  const at = (x: number, y: number) => page.mouse.click(box.x + (x / 886) * box.width, box.y + (y / 886) * box.height);
  await at(372, 511);
  await expect(page.locator("#speak")).toBeDisabled();
  await expect(page.locator("#status")).toContainText("RIGHT corner");
  await at(560, 511);
  await expect(page.locator("#status")).toContainText("Mouth marked. Ready — press Speak");
  await expect(page.locator("#speak")).toBeEnabled();

  await page.evaluate(() => ((window as unknown as Hook).__talkingAvatar.renderer.manualViseme = "A"));
  expect(await mouthPixel(page)).toBeLessThan(200);
});

test("Speak is disabled until the photo's face is ready", async ({ page }) => {
  await expect(page.locator("#status")).toContainText("Ready — press Speak");
  await expect(page.locator("#speak")).toBeEnabled();
  // Hold the face model download so the busy state can be observed
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/mediapipe-models/, async (route) => {
    await held;
    await route.continue();
  });
  await page.locator("#avatar-photo").setInputFiles("public/avatars/sample-photo/face.png");
  await expect(page.locator("#status")).toContainText("Finding the face");
  await expect(page.locator("#speak")).toBeDisabled();
  await expect(page.locator("#record")).toBeDisabled();
  release();
  await expect(page.locator("#status")).toContainText("Ready — press Speak", { timeout: 20_000 });
  await expect(page.locator("#speak")).toBeEnabled();
});
