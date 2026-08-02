export type FeatureFlag =
  | "announcements"
  | "sponsors"
  | "communityBanner";

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  announcements: false,
  sponsors: false,
  communityBanner: false,
};

const ENV_KEYS: Record<FeatureFlag, string> = {
  announcements: "NEXT_PUBLIC_FEATURE_ANNOUNCEMENTS",
  sponsors: "NEXT_PUBLIC_FEATURE_SPONSORS",
  communityBanner: "NEXT_PUBLIC_FEATURE_COMMUNITY_BANNER",
};

/**
 * Feature flags gate optional, non-core UI surfaces (e.g. ad placeholders).
 * Flags default to disabled. Enable per environment with:
 *   NEXT_PUBLIC_FEATURE_ANNOUNCEMENTS=true
 *   NEXT_PUBLIC_FEATURE_SPONSORS=true
 *   NEXT_PUBLIC_FEATURE_COMMUNITY_BANNER=true
 */
export function isFeatureEnabled(name: FeatureFlag): boolean {
  const envValue = process.env[ENV_KEYS[name]];
  if (envValue !== undefined) {
    return envValue === "true" || envValue === "1";
  }
  return DEFAULT_FLAGS[name];
}
