import { TERMS_DRAFT } from "@heft/shared";

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Terms of Service</h1>
      {TERMS_DRAFT.split("\n\n").map((paragraph) => (
        <p key={paragraph.slice(0, 32)} className="mt-4 text-sm leading-6">
          {paragraph}
        </p>
      ))}
    </>
  );
}