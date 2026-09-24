import { APP_NAME } from "./brand";

/**
 * Trust claims stay off until the product can make them true.
 * Components read these flags. Only the off copy ships.
 */
export const TRUST = {
  insuranceVerifiedWording: false,
  tippingLive: false,
} as const;

export function approvedByLabel(): string {
  return `Approved by ${APP_NAME}`;
}

export function driversApprovedLabel(): string {
  return `Drivers approved by ${APP_NAME}`;
}

/** Stars are collected ratings, not a trust claim. Under 3 ratings, say New driver. */
export function driverRatingLabel(ratingCount: number, ratingAvg: number | string | null | undefined): string {
  if (ratingCount >= 3 && ratingAvg != null && Number.isFinite(Number(ratingAvg))) {
    return Number(ratingAvg).toFixed(1);
  }
  return "New driver";
}

export function showStarRating(ratingCount: number): boolean {
  return ratingCount >= 3;
}
