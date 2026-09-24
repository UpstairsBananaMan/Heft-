import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "./demo/seed";
import { postsForFeed, type FeedPost } from "./feed";

function post(partial: Partial<FeedPost> & Pick<FeedPost, "id" | "is_demo" | "status">): FeedPost {
  return {
    job_id: null,
    item_label: "Couch",
    size_label: "Large",
    item_type: "couch",
    size_category: "large",
    pickup_area: "East Hill",
    dropoff_area: "Cordova",
    month_label: "September",
    driver_name: null,
    rating_avg: null,
    rating_count: null,
    before_key: null,
    after_key: null,
    ...partial,
  };
}

test("feed visibility", async (t) => {
  await t.test("hides a real feed until three approved posts exist", () => {
    const real = [post({ id: "a", is_demo: false, status: "approved" }), post({ id: "b", is_demo: false, status: "approved" })];
    assert.equal(postsForFeed(real, false).length, 0);
    real.push(post({ id: "c", is_demo: false, status: "pending" }));
    assert.equal(postsForFeed(real, false).length, 0);
    real.push(post({ id: "d", is_demo: false, status: "approved" }));
    assert.equal(postsForFeed(real, false).length, 3);
  });

  await t.test("demo samples stay out of the real feed", () => {
    const mixed = [
      post({ id: "a", is_demo: true, status: "approved" }),
      post({ id: "b", is_demo: true, status: "approved" }),
      post({ id: "c", is_demo: true, status: "approved" }),
    ];
    assert.equal(postsForFeed(mixed, false).length, 0);
    assert.equal(postsForFeed(mixed, true).length, 3);
  });

  await t.test("seeds three approved demo posts", () => {
    const state = createDemoState();
    const posts = state.feed_posts as FeedPost[];
    assert.equal(postsForFeed(posts, true).length, 3);
    assert.equal(posts.every((item) => item.is_demo), true);
    assert.equal(postsForFeed(posts, false).length, 0);
  });
});
