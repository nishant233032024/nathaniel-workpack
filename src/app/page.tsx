import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="wrap">
      <section className="hero">
        <p className="eyebrow">Founding engineer work pack</p>
        <h1>
          Two working builds, <em>one</em> shared money engine, and the plan for a Mac app.
        </h1>
        <p className="lede">
          The melody book with rhythm, numbers and swaras in all twelve keys. A fees portal that imports the real
          exports, refuses to guess, and shows every rupee twice before it trusts it.
        </p>
      </section>

      <div className="split">
        <Link className="card card--link" href="/dhun">
          <span className="card__kicker">Part 1</span>
          <h2>Dhun, rebuilt</h2>
          <p>A tune shelf and working tune pages. Handwritten notation, a piano you can hear, and twelve keys.</p>
          <span className="card__cta">Open the shelf →</span>
        </Link>

        <Link className="card card--link" href="/fees">
          <span className="card__kicker">Parts 2 &amp; 3</span>
          <h2>The fees portal</h2>
          <p>25 students, 40 payments, the October receipts before and after PayPal, GST shown apart, and a queue for what a human must decide.</p>
          <span className="card__cta">Open the portal →</span>
        </Link>
      </div>

      <section className="card card--flat">
        <h2>What is real here</h2>
        <ul className="ticks">
          <li>Both supplied CSVs are imported as-is. Raw values are kept beside normalised ones.</li>
          <li>Balances are derived on every read, so re-importing the same file cannot count a rupee twice.</li>
          <li>Every review item shows its source row, the reason, and what it would do to cash and to student credit.</li>
          <li>All money is integer minor units. No floating point arithmetic touches a balance.</li>
          <li>The same engine runs the portal and the daily reminders skill.</li>
        </ul>
      </section>
    </div>
  );
}
