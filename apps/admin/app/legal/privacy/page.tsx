import { PRIVACY_DRAFT } from "@heft/shared";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      {PRIVACY_DRAFT.split("\n\n").map((paragraph) => (
        <p key={paragraph.slice(0, 32)} className="mt-4 text-sm leading-6">
          {paragraph}
        </p>
      ))}
    </>
  );
}
