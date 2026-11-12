import Link from 'next/link';

/** A wrong link should still look like the rest of the app. */
export default function NotFound() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <p className="eyebrow">404</p>
          <h1>That page is not here</h1>
          <p className="lede">
            A mistyped link, or a tune that is not on the shelf. The pack carries Twinkle Twinkle Little Star, Ode to
            Joy and Happy Birthday.
          </p>
        </div>
      </div>

      <div className="actions">
        <Link className="btn btn--primary" href="/dhun">
          The tune shelf
        </Link>
        <Link className="btn btn--ghost" href="/fees">
          The fees desk
        </Link>
        <Link className="btn btn--ghost" href="/">
          Start again
        </Link>
      </div>
    </div>
  );
}
