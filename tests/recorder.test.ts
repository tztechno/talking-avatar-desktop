import { describe, expect, it } from "vitest";
import { extensionFor, pickMimeType } from "../src/export/recorder";

describe("recorder mime selection", () => {
  it("prefers webm, falls back to mp4", () => {
    expect(pickMimeType(() => true)).toBe("video/webm;codecs=vp9,opus");
    expect(pickMimeType((t) => t.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(pickMimeType(() => false)).toBeUndefined();
    expect(extensionFor("video/mp4")).toBe("mp4");
    expect(extensionFor("video/webm")).toBe("webm");
  });
});
