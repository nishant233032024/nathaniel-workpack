import Link from 'next/link';

export const metadata = {
  title: 'Notes — decisions, AI use, and what is not done',
};

export default function NotesPage() {
  return (
    <div className="wrap">
      <section className="hero">
        <p className="eyebrow">Read me before the video</p>
        <h1>What is honest here, and what is not.</h1>
        <p className="lede">
          The full written record lives in <code>docs/</code>. This page is the short version I would want a reviewer to
          read first.
        </p>
      </section>

      <section className="card card--flat">
        <h2>How I used AI, and where I overruled it</h2>
        <p>
          I used an AI coding agent to scaffold the project and to write large parts of the code, working from rules I
          set. In every part, the AI produced something plausible that was wrong, and I caught it by checking:
        </p>
        <ul className="ticks">
          <li>
            <strong>Money.</strong> A first pass treated a negative amount as a normal payment and quietly reduced the
            month&apos;s income. Refunds are not inferred here: the row waits for a person.
          </li>
          <li>
            <strong>Instalments.</strong> I expected €350 to split as 117 / 117 / 116. The engine said 116.67 each, and
            the engine was right — 350 ÷ 3 = 116.67, and the student&apos;s rounded €117 payment leaves 33 cents of
            credit. The test was wrong, not the code.
          </li>
          <li>
            <strong>Duplicates.</strong> The repeated Diya Fernandes row is the trap in this data. Counting it twice
            makes her look fully paid; she is ₹5,000 short. There is now a test that fails if that changes.
          </li>
          <li>
            <strong>Spelling.</strong> A lookup table of note names gives Gb in G major. Deriving the letter from the
            scale degree gives F♯ every time, in all twelve keys.
          </li>
        </ul>
        <p className="small muted">
          The exact prompts, the mistakes and the fixes are recorded in <code>docs/ai-use.md</code>.
        </p>
      </section>

      <section className="card card--flat">
        <h2>Three decisions I would defend in the room</h2>
        <ul className="ticks">
          <li>
            <strong>Cash is not credit.</strong> A payment can be real money and still not belong to a student. The
            portal keeps gross cash received, unallocated cash and student credit as three separate numbers, because
            collapsing them is how a portal starts lying.
          </li>
          <li>
            <strong>Balances are derived, never stored.</strong> The database holds source rows and human decisions
            only. That is why re-importing the same file cannot double-count anything — there is no running total to
            double.
          </li>
          <li>
            <strong>A weak match is not a match.</strong> &ldquo;Tara P.&rdquo; with a different email is offered as a
            one-line hint and nothing more. Her reminder is held until a person decides, because the ₹15,000 could
            clear her balance.
          </li>
        </ul>
      </section>

      <section className="card card--flat">
        <h2>Not done, and said plainly</h2>
        <ul className="ticks">
          <li>The piano is synthesised, not sampled. There is no bundled sample library and nothing to license.</li>
          <li>There is no phone number column in the export, so reminders are drafts with no recipient attached.</li>
          <li>
            The source data has no phone numbers and no GSTIN, so GST is a computed portion of receipts, not a filing.
          </li>
          <li>Shruti (Part 4) is researched architecture, not a native app. The diagrams are editable draw.io files.</li>
        </ul>
      </section>

      <p className="small muted">
        <Link href="/fees">← Back to the fees desk</Link>
      </p>
    </div>
  );
}
