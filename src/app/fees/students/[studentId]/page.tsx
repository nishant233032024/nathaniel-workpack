import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { loadFees } from '@/lib/db/load';
import { formatMoney } from '@/lib/finance/money';
import type { InstalmentStatus } from '@/lib/finance/types';

const INSTALMENT_LABEL: Record<InstalmentStatus, string> = {
  paid: 'paid',
  partial: 'part paid',
  due: 'due',
  overdue: 'overdue',
  future: 'future',
  waived: 'waived',
};

export default async function StudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  // Derived per request, never a build-time snapshot.
  await connection();

  const { studentId } = await params;
  const { result } = await loadFees();

  if (!result) notFound();

  const account = result.students.find((item) => item.student.studentId === studentId);
  if (!account) notFound();

  const { student } = account;

  return (
    <div className="wrap">
      <Link className="back-link" href="/fees">
        ← Back to the desk
      </Link>

      <div className="page-head">
        <div>
          <p className="eyebrow">
            {student.studentId} · {student.country} · starts {student.startDate}
          </p>
          <h1>{student.name}</h1>
          <p className="lede">
            {student.course} · {student.planRaw} · billed in {student.currency}
          </p>
        </div>
        <span className={`badge badge--${account.status}`}>{account.status}</span>
      </div>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi__label">Agreed fee</div>
          <div className="kpi__value">{formatMoney(student.courseFeeMinor, student.currency)}</div>
        </div>
        <div className="kpi kpi--good">
          <div className="kpi__label">Credited</div>
          <div className="kpi__value">{formatMoney(account.creditedMinor, student.currency)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Balance</div>
          <div className="kpi__value">{formatMoney(account.balanceMinor, student.currency)}</div>
        </div>
        <div className="kpi kpi--alert">
          <div className="kpi__label">Overdue</div>
          <div className="kpi__value">{formatMoney(account.overdueMinor, student.currency)}</div>
          <div className="kpi__note">{account.daysOverdue} days past the oldest open due date</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">On account</div>
          <div className="kpi__value">{formatMoney(account.overpaymentCreditMinor, student.currency)}</div>
          <div className="kpi__note">paid beyond the fee</div>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel__head">
            <h2>The schedule</h2>
            <p>First due on the start date, then every 30 days.</p>
          </div>
          <div className="panel__body">
            <table className="schedule">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Applied</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {account.instalments.map((instalment) => (
                  <tr key={instalment.index}>
                    <td>{instalment.index}</td>
                    <td>{instalment.dueDate}</td>
                    <td>{formatMoney(instalment.amountMinor, student.currency)}</td>
                    <td>{formatMoney(instalment.paidMinor, student.currency)}</td>
                    <td>
                      <span
                        className={`badge ${
                          instalment.status === 'paid'
                            ? 'badge--paid'
                            : instalment.status === 'overdue' || instalment.status === 'partial'
                              ? 'badge--overdue'
                              : 'badge--due'
                        }`}
                      >
                        {INSTALMENT_LABEL[instalment.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: '0.7rem' }}>
              Credit is applied oldest-first, so “which instalment is this money for?” has one answer.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Evidence</h2>
            <p>Every row that touched this account, with its source line.</p>
          </div>
          <div className="panel__body">
            {account.lines.length === 0 ? (
              <p className="muted">No payment row has been allocated to this student.</p>
            ) : (
              <table className="schedule">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {account.lines.map((line) => (
                    <tr key={line.row.paymentId}>
                      <td>
                        {line.row.paymentId}
                        <div className="muted small">row {line.row.sourceRow}</div>
                      </td>
                      <td>{line.row.date}</td>
                      <td>
                        {line.row.currencyRaw} {line.row.amountRaw}
                      </td>
                      <td>
                        <span className={`badge ${line.status === 'credited' ? 'badge--paid' : 'badge--overdue'}`}>
                          {line.status}
                        </span>
                      </td>
                      <td className="evidence">{line.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {account.reminderHeld && (
              <div className="review-item" style={{ marginTop: '0.9rem', borderLeftColor: 'var(--amber)' }}>
                <p className="review-item__reason">Reminder held</p>
                <p className="small muted">{account.holdReasons.join('; ')}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
