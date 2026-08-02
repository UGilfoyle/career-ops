import releaseData from '@/content/release-v3.json';

export type ProductFeature = {
  id: string;
  badge: string;
  title: string;
  summary: string;
  detail: string;
};

export type ProductRelease = {
  id: string;
  version: string;
  title: string;
  tagline: string;
  headline: string;
  subheadline: string;
  storageKey: string;
  features: ProductFeature[];
};

export const CURRENT_RELEASE = releaseData as ProductRelease;

export function releaseSeenKey(): string {
  return CURRENT_RELEASE.storageKey;
}
