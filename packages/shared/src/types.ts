export const ROLES = ["customer", "driver", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const VEHICLE_TYPES = ["pickup", "cargo_van", "box_truck", "flatbed"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const SIZE_CATEGORIES = ["small", "medium", "large", "xl", "truckload"] as const;
export type SizeCategory = (typeof SIZE_CATEGORIES)[number];

export const JOB_STATUSES = [
  "draft",
  "priced",
  "open",
  "assigned",
  "en_route_pickup",
  "at_pickup",
  "en_route_dropoff",
  "at_dropoff",
  "delivered",
  "paid",
  "cancelled",
  "disputed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const DRIVER_STATUSES = ["pending", "approved", "suspended"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DISPUTE_STATUSES = [
  "open",
  "investigating",
  "resolved_customer",
  "resolved_driver",
  "closed",
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const PAYOUT_STATUSES = ["pending", "paid", "failed"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PHOTO_KINDS = ["item", "pickup", "pod"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export interface User {
  id: string;
  role: Role;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  user_id: string;
  default_address: string | null;
  default_lat: number | null;
  default_lng: number | null;
  rating_avg: number | string;
  rating_count: number;
}

export interface DriverProfile {
  user_id: string;
  status: DriverStatus;
  vehicle_type: VehicleType | null;
  capacity_lbs: number | null;
  bed_length_ft: number | string | null;
  service_lat: number | null;
  service_lng: number | null;
  partner_only?: boolean;
  background_check_at?: string | null;
  background_check_by?: string | null;
  service_radius_miles: number | string;
  plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  service_zip: string | null;
  stripe_connect_account_id: string | null;
  rating_avg: number | string;
  rating_count: number;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_seen_at: string | null;
  show_name_in_feed?: boolean;
}

export interface Job {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: JobStatus;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_notes: string | null;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_notes: string | null;
  item_description: string;
  item_type: string | null;
  size_category: SizeCategory;
  vehicle_required: VehicleType;
  stairs_pickup_flights: number;
  stairs_dropoff_flights: number;
  needs_second_person: boolean;
  size_tier?: SizeCategory | null;
  weight_band?: string | null;
  billable_miles?: number | null;
  distance_source?: "maps" | "estimated" | null;
  est_job_minutes?: number | null;
  rates_version?: string | null;
  quoted_at?: string | null;
  pickup_zip?: string | null;
  dropoff_zip?: string | null;
  pickup_in_zone?: boolean | null;
  dropoff_in_zone?: boolean | null;
  driver_share_cents?: number | null;
  lead_payout_cents?: number | null;
  helper_payout_cents?: number | null;
  partner_driver_id?: string | null;
  partner_lost_at?: string | null;
  dropoff_placement: "inside" | "curbside";
  quote_lines: { key: string; label: string; cents: number }[] | null;
  distance_miles: number | string | null;
  estimate_cents: number | null;
  final_cents: number | null;
  platform_fee_cents: number | null;
  driver_payout_cents: number | null;
  stripe_payment_intent_id: string | null;
  scheduled_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  market: string;
  vehicle_type: VehicleType;
  size_category: SizeCategory;
  base_cents: number;
  per_mile_cents: number;
  min_cents: number;
  size_multiplier: number | string;
  active: boolean;
  effective_from: string;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  storage_path: string;
  kind: PhotoKind;
  created_at: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Rating {
  id: string;
  job_id: string;
  from_user_id: string;
  to_user_id: string;
  stars: number;
  comment: string | null;
  share_photos?: boolean;
  created_at: string;
}

export interface Dispute {
  id: string;
  job_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_notes: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Payout {
  id: string;
  driver_id: string;
  job_id: string;
  amount_cents: number;
  stripe_transfer_id: string | null;
  status: PayoutStatus;
  role?: "lead" | "partner";
  created_at: string;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android";
  updated_at: string;
}

export interface QuoteResult {
  estimate_cents: number;
  distance_miles: number;
  distance_source: "maps" | "estimated" | "google" | "haversine";
  platform_fee_cents: number;
  driver_payout_cents: number;
  currency: "usd";
  job_id?: string;
  status?: JobStatus;
}

export interface PlacePreset {
  label: string;
  address: string;
  lat: number;
  lng: number;
  outside?: boolean;
  zip?: string | null;
}
