import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <p className="label">no such case</p>
      <h1 className="display mt-4 text-[clamp(2.6rem,9vw,5rem)]">
        nothing filed
        <br />
        under that name
      </h1>
      <p className="mt-6 max-w-md leading-relaxed text-ink-soft">
        The court keeps one file per repository, addressed as{" "}
        <span className="mono text-[0.9rem]">/repo/owner/name</span>.
      </p>
      <Link href="/" className="btn mt-8 inline-block">
        ← back to the docket
      </Link>
    </main>
  );
}
