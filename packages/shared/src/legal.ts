export const LEGAL_DRAFT_BANNER =
  "DRAFT. This is a placeholder for Heft, not legal advice, and not a finished Privacy Policy or Terms of Service. Have a lawyer replace it before anyone relies on it.";

export const PRIVACY_DRAFT = [
  LEGAL_DRAFT_BANNER,
  "Heft is a Pensacola bulky-item delivery app. A customer requests a pickup. A driver accepts it. An admin approves drivers and reads disputes.",
  "The app can store an email, a display name, a phone number, job addresses, item photos, a proof-of-delivery photo, and the driver’s location while a job is active.",
  "Payments in this build can be a sandbox hold. No live card charge happens until Stripe keys are added outside this repository.",
  "Do not treat this page as a promise about selling data, retention, or your rights. Those sentences are not written yet.",
].join("\n\n");

export const TERMS_DRAFT = [
  LEGAL_DRAFT_BANNER,
  "Using Heft means you request or perform a bulky-item delivery in the Pensacola service area. One account is one role: customer or driver. Admin accounts are not created in the app.",
  "A customer can cancel before a driver accepts, and after a driver is assigned until the driver marks at pickup. A driver can cancel only while assigned or en route to pickup. Either party can open a dispute after a driver accepts, and for 72 hours after the job is paid.",
  "Quotes use the pricing rules in the database. A sandbox publish does not charge a card. Store listings, live Stripe, and live maps are separate unlocks and are not included by installing this code.",
  "Replace this draft with terms a lawyer has reviewed before a public store release.",
].join("\n\n");
