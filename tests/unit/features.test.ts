import { afterEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/features";

describe("isFeatureEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled by default for every flag", () => {
    expect(isFeatureEnabled("announcements")).toBe(false);
    expect(isFeatureEnabled("sponsors")).toBe(false);
    expect(isFeatureEnabled("communityBanner")).toBe(false);
  });

  it("enables a flag when the env var is 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_ANNOUNCEMENTS", "true");
    expect(isFeatureEnabled("announcements")).toBe(true);
  });

  it("enables a flag when the env var is '1'", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_SPONSORS", "1");
    expect(isFeatureEnabled("sponsors")).toBe(true);
  });

  it("treats any other value as disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_COMMUNITY_BANNER", "yes");
    expect(isFeatureEnabled("communityBanner")).toBe(false);
  });
});
