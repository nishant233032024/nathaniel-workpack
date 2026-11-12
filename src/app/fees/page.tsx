import Link from 'next/link';
import { connection } from 'next/server';
import { loadFees } from '@/lib/db/load';
import { formatMoney } from '@/lib/finance/money';
import { resolvePayment, undoResolution } from './actions';
import type { AccountStatus, ReviewItem, StudentAccount } from '@/lib/finance/types';

const STATUS_LABEL: Record<AccountStatus, string> = {
  paid: 'paid',
  credit: 'on account',
  due: 'due',
  overdue: 'overdue',
  review: 'needs a person',
};

function StudentRow({ account }: { account: StudentAccount }) {
  const { student } = account;
  return (
    <tr>
      <td>
        <Link href={`/fees/students/${student.studentId}`} className="strong">
          {student.name}
        </Link>
        <div className="muted small">{student.studentId} · {student.country}</div>
      </td>
      <td>
        {student.course}
        <div className="muted small">{student.planRaw}</div>
      </td>
      <td className="num">{formatMoney(student.courseFeeMinor, student.currency)}</td>
      <td className="num">{formatMoney(account.creditedMinor, student.currency)}</td>
      <td className="num strong">{formatMoney(account.balanceMinor, student.currency)}</td>
      <td className="num">
        {account.overdueMinor > 0 ? (
          <>
            {formatMoney(account.overdueMinor, student.currency)}
            <div className="muted small">{account.daysOverdue} days</div>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <span className={`badge badge--${account.status}`}>{STATUS_LABEL[account.status]}</span>
        {account.overpaymentCreditMinor > 0 && (
          <div className="muted small">credit {formatMoney(account.overpaymentCreditMinor, student.currency)}</div>
        )}
        {account.reminderHeld && <div><span className="badge badge--held">held</span></div>}
      </td>
      <td>
        <Link className="btn btn--ghost btn--tiny" href={`/fees/students/${student.studentId}`}>
          Why?
        </Link>
      </td>
    </tr>
  );
}

function ReviewCard({ item, students }: { item: ReviewItem; students: StudentAccount[] }) {
  const open = item.status === 'open';
  return (
    <article className={`review-item ${item.status === 'auto_resolved' ? 'review-item--auto' : ''}`}>
      <div className="review-item__top">
        <div>
          <span className="review-item__id">
            {item.paymentId} · source row {item.sourceRow} · {item.date}
          </span>
          <p className="review-item__reason">{item.reasons[0]?.message ?? 'needs review'}</p>
        </div>
        <span className={`badge ${item.status === 'auto_resolved' ? 'badge--paid' : open ? 'badge--review' : 'badge--paid'}`}>
          {item.status.replace('_', ' ')}
        </span>
      </div>

      <div className="review-item__meta">
        {item.payerName || '(no name)'} · {item.payerEmail || '(no email)'} · {item.currencyRaw} {item.amountRaw} ·{' '}
        {item.method || 'no method'} · ref {item.reference || 'none'}
        {item.note ? ` · note: “${item.note}”` : ''}
      </div>

      <div className="review-item__treatments">
        <div className="treatment">
          <span>cash today</span>
          {item.cashTreatment}
        </div>
        <div className="treatment">
          <span>student credit</span>
          {item.creditTreatment}
        </div>
      </div>

      {item.candidates.length > 0 && (
        <ul className="candidates">
          {item.candidates.map((candidate) => (
            <li key={candidate.studentId}>
              {candidate.confidence === 'strong' ? '●' : '○'} {candidate.studentId} {candidate.name} —{' '}
              <span className="muted">
                {candidate.evidence} ({candidate.confidence})
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="actions">
          {item.allowedActions.includes('assign') && (
            <form action={resolvePayment} className="actions">
              <input type="hidden" name="paymentId" value={item.paymentId} />
              <input type="hidden" name="action" value="assign" />
              <select name="studentId" defaultValue={item.candidates[0]?.studentId ?? ''} aria-label="Student">
                <option value="">choose student…</option>
                {students.map((account) => (
                  <option key={account.student.studentId} value={account.student.studentId}>
                    {account.student.studentId} · {account.student.name} ({account.student.currency})
                  </option>
                ))}
              </select>
              <label className="checkline">
                <input type="checkbox" name="allowCrossCurrency" /> convert currency
              </label>
              <button type="submit" className="btn btn--primary btn--tiny">
                Assign
              </button>
            </form>
          )}

          {item.allowedActions.includes('unallocated') && (
            <form action={resolvePayment}>
              <input type="hidden" name="paymentId" value={item.paymentId} />
              <input type="hidden" name="action" value="unallocated" />
              <button type="submit" className="btn btn--ghost btn--tiny">
                Real cash, no student
              </button>
            </form>
          )}

          {item.allowedActions.includes('accept_refund') && (
            <form action={resolvePayment}>
              <input type="hidden" name="paymentId" value={item.paymentId} />
              <input type="hidden" name="action" value="accept_refund" />
              <button type="submit" className="btn btn--ghost btn--tiny">
                Approve refund
              </button>
            </form>
          )}

          <form action={resolvePayment}>
            <input type="hidden" name="paymentId" value={item.paymentId} />
            <input type="hidden" name="action" value="hold" />
            <button type="submit" className="btn btn--ghost btn--tiny">
              Hold
            </button>
          </form>
        </div>
      ) : (
        item.resolution && (
          <form action={undoResolution} className="actions">
            <input type="hidden" name="paymentId" value={item.paymentId} />
            <span className="muted small">
              {item.resolution.action} by {item.resolution.decidedBy}
            </span>
            <button type="submit" className="btn btn--ghost btn--tiny">
              Undo
            </button>
          </form>
        )
      )}
    </article>
  );
}

export default async function FeesPage() {
  // Balances are derived per request and decisions are written back, so this
  // route is never a build-time snapshot: a resolution added a second ago shows
  // up on the next request.
  await connection();

  const { empty, result, audit, dbError } = await loadFees();

  if (empty || !result) {
    return (
      <div className="wrap">
        <h1>The fees desk</h1>
        <div className="panel">
          <div className="empty">
            {dbError ? (
              <>
                <h2>The fees database is not connected</h2>
                <p>{dbError}</p>
                <p className="small">
                  On a hosted deployment, set <code>DATABASE_URL</code> to a Postgres connection string and import the
                  CSVs once. Locally, run <code>npm run db:import</code>.
                </p>
              </>
            ) : (
              <>
                <h2>No data yet</h2>
                <p>The portal reads from SQLite. Build it from the two supplied CSVs:</p>
                <pre>
                  <code>{`npm run db:import\nnpm run dev`}</code>
                </pre>
                <p className="small">
                  The database file is gitignored; the CSVs and the importer are in the repo.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const openReview = result.review.filter((item) => item.status === 'open');
  const heldCount = result.reminders.filter((reminder) => reminder.held).length;

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <p className="eyebrow">Parts 2 &amp; 3 · the money</p>
          <h1>Fees desk</h1>
          <p className="lede">
            25 students, 40 payment rows, and every rupee traced back to a source line. Anything the code cannot prove
            waits for a person.
          </p>
        </div>
        <span className="asof">● as of 31 Oct 2026 · Asia/Kolkata</span>
      </div>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi__label">Agreed fees</div>
          <div className="kpi__value">{formatMoney(result.totals.totalAgreedFeeInrPaise, 'INR')}</div>
          <div className="kpi__note">25 students, converted at ₹84 / ₹91</div>
        </div>
        <div className="kpi kpi--good">
          <div className="kpi__label">Credited to fees</div>
          <div className="kpi__value">{formatMoney(result.totals.totalCreditedInrPaise, 'INR')}</div>
          <div className="kpi__note">money allocated to a student</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Still to collect</div>
          <div className="kpi__value">{formatMoney(result.totals.totalBalanceInrPaise, 'INR')}</div>
          <div className="kpi__note">includes future instalments</div>
        </div>
        <div className="kpi kpi--alert">
          <div className="kpi__label">Overdue today</div>
          <div className="kpi__value">{formatMoney(result.totals.totalOverdueInrPaise, 'INR')}</div>
          <div className="kpi__note">{result.reminders.length} students past a due date</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Held on account</div>
          <div className="kpi__value">{formatMoney(result.totals.totalOverpaymentCreditInrPaise, 'INR')}</div>
          <div className="kpi__note">paid beyond the agreed fee</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Unallocated cash</div>
          <div className="kpi__value">{formatMoney(result.totals.totalUnallocatedCashInrPaise, 'INR')}</div>
          <div className="kpi__note">received, owned by nobody yet</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>October receipts</h2>
          <p>Cash basis. What arrived this month, and what the processors kept.</p>
        </div>
        <div className="panel__body">
          <div className="receipts">
            <div className="receipt">
              <div className="receipt__label">Gross receipts</div>
              <div className="receipt__value">{formatMoney(result.receipts.grossInrPaise, 'INR')}</div>
              <div className="small muted">{result.receipts.lines.length} receipts</div>
            </div>
            <div className="receipt">
              <div className="receipt__label">PayPal fees</div>
              <div className="receipt__value">−{formatMoney(result.receipts.processorFeesInrPaise, 'INR')}</div>
              <div className="small muted">4.4% + 0.30 in the payment currency</div>
            </div>
            <div className="receipt receipt--net">
              <div className="receipt__label">Net receipts</div>
              <div className="receipt__value">{formatMoney(result.receipts.netInrPaise, 'INR')}</div>
              <div className="small muted">what reached the school</div>
            </div>
            <div className="receipt">
              <div className="receipt__label">GST included</div>
              <div className="receipt__value">{formatMoney(result.receipts.gstInrPaise, 'INR')}</div>
              <div className="small muted">
                on {formatMoney(result.receipts.gstApplicableGrossInrPaise, 'INR')} of Indian receipts
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Method</th>
                  <th className="num">Gross in ₹</th>
                  <th className="num">PayPal</th>
                  <th className="num">Net</th>
                  <th className="num">GST</th>
                </tr>
              </thead>
              <tbody>
                {result.receipts.lines.map((line) => {
                  const account = result.students.find((a) => a.student.studentId === line.studentId);
                  return (
                    <tr key={line.row.paymentId}>
                      <td className="strong">{line.row.paymentId}</td>
                      <td>{line.row.date}</td>
                      <td>{account?.student.name ?? <span className="muted">unallocated</span>}</td>
                      <td>{line.row.method}</td>
                      <td className="num">{formatMoney(line.cashInrPaise, 'INR')}</td>
                      <td className="num">{line.processorFeeInrPaise ? formatMoney(line.processorFeeInrPaise, 'INR') : '—'}</td>
                      <td className="num strong">{formatMoney(line.cashInrPaise - line.processorFeeInrPaise, 'INR')}</td>
                      <td className="num">{line.gstInrPaise ? formatMoney(line.gstInrPaise, 'INR') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: '0.7rem' }}>
            GST is recognised on receipts from students in India paid in INR (gross × 18/118). The two USD PayPal
            receipts are exports of service and carry no GST here. Processor fees are never deducted before GST is
            extracted. An unapproved refund is excluded until a person approves it.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Every student</h2>
          <p>Balances are derived, never stored. Click “Why?” for the schedule and the source rows.</p>
        </div>
        <div className="panel__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th className="num">Fee</th>
                  <th className="num">Credited</th>
                  <th className="num">Balance</th>
                  <th className="num">Overdue</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.students.map((account) => (
                  <StudentRow key={account.student.studentId} account={account} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Needs a person</h2>
          <p>
            {openReview.length} open · {result.review.length - openReview.length} auto-resolved. Nothing here has been
            guessed.
          </p>
        </div>
        <div className="panel__body">
          <div className="review-list">
            {result.review.map((item) => (
              <ReviewCard key={item.paymentId} item={item} students={result.students} />
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Reminder drafts</h2>
          <p>
            {result.reminders.length} drafts · {heldCount} held. Drafted only — nothing is sent from this app.
          </p>
        </div>
        <div className="panel__body">
          <div className="reminders">
            {result.reminders.map((reminder) => (
              <div key={reminder.studentId} className={`reminder ${reminder.held ? 'reminder--held' : ''}`}>
                <div className="reminder__head">
                  <span className="reminder__name">
                    {reminder.studentName} · {reminder.studentId}
                  </span>
                  <span className="badge badge--overdue">{reminder.daysOverdue} days</span>
                </div>
                <textarea readOnly value={reminder.message} rows={4} aria-label={`Message for ${reminder.studentName}`} />
                {reminder.held ? (
                  <p className="reminder__hold">
                    <strong>Held.</strong> {reminder.holdReasons.join('; ')}
                  </p>
                ) : (
                  <p className="small muted" style={{ margin: '0.4rem 0 0' }}>
                    No phone number in the export — paste into WhatsApp. Amount is in {reminder.currency}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Audit trail</h2>
          <p>Imports and human decisions, newest first.</p>
        </div>
        <div className="panel__body">
          <ul className="audit">
            {audit.map((entry) => (
              <li key={entry.id}>
                {entry.at} · {entry.actor} · {entry.action}
                {entry.paymentId ? ` · ${entry.paymentId}` : ''}
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: '0.6rem' }}>
            Fingerprint of these inputs: <code>{result.inputFingerprint}</code>. Same inputs and same as-of date
            produce the same fingerprint and the same balances.
          </p>
        </div>
      </section>
    </div>
  );
}
