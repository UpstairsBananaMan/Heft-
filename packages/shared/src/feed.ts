import { neighbourhood } from "./geo";
import { SIZE_LABEL } from "./status";

export type FeedStatus = "pending" | "approved" | "rejected";

export type FeedPost = {
  id: string;
  job_id: string | null;
  status: FeedStatus;
  is_demo: boolean;
  item_label: string;
  size_label: string;
  item_type: string | null;
  size_category: string | null;
  pickup_area: string;
  dropoff_area: string;
  month_label: string;
  driver_name: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  before_key: string | null;
  after_key: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(iso: string): string {
  const date = new Date(iso);
  const name = MONTHS[date.getMonth()];
  return name ?? "";
}

/** Real feeds stay hidden under 3 approved posts. Demo shows its own approved samples. */
export function postsForFeed(posts: FeedPost[], demo: boolean): FeedPost[] {
  const approved = posts.filter((post) => post.status === "approved" && Boolean(post.is_demo) === demo);
  if (approved.length < 3) return [];
  return approved;
}

export function feedAreas(pickupAddress: string, dropoffAddress: string): { pickup_area: string; dropoff_area: string } {
  return {
    pickup_area: neighbourhood(pickupAddress),
    dropoff_area: neighbourhood(dropoffAddress),
  };
}

export function sizePhrase(size: string | null | undefined): string {
  if (!size) return "";
  return SIZE_LABEL[size] ?? size;
}
