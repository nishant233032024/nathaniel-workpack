import { DEFAULT_ASSUMPTIONS } from './config';
import { findCandidates, detectDuplicateRows } from './matching';
import {
  formatMoney,
  gstIncludedInGross,
  isIsoDate,
  daysBetween,
  paypalFeeMinor,
  toInrPaise,
} from './money';
import {
  allocateToSchedule,
  buildSchedule,
  daysOverdueOf,
  futureMinorOf,
  overdueMinorOf,
} from './schedule';
import type {
  Assumptions,
  Candidate,
  Currency,
  PaymentLine,
  PaymentRow,
  Reason,
  ReasonCode,
  ReceiptsSummary,
  ReconcileResult,
  ReminderDraft,
  Resolution,
  ReviewItem,
  Student,
  StudentAccount,
  Totals,
} from './types';

export interface ReconcileInput {
  students: Student[];
  payments: PaymentRow[];
  resolutions?: Resolution[];
  assumptions?: Assumptions;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function reason(code: ReasonCode, message: string): Reason {
  return { code, message };
}

/** Stable 64-bit FNV-1a hash so identical inputs get an identical fingerprint. */
function fingerprint(payload: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= BigInt(payload.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/** Cash, processor fee and GST for an amount that actually reached the school. */
function moneyEffects(
  row: PaymentRow,
  amountMinor: number,
  currency: Currency,
  country: string | null,
  assumptions: Assumptions,
) {
  const grossInrPaise = toInrPaise(amountMinor, currency, assumptions);
  const isPaypal = row.method.trim().toLowerCase() === 'paypal';
  const processorFeeInrPaise = isPaypal
    ? toInrPaise(paypalFeeMinor(amountMinor, assumptions), currency, assumptions)
    : 0;
  const gstApplicable = country !== null && assumptions.gstCountries.includes(country) && currency === 'INR';
  const gstInrPaise = gstApplicable ? gstIncludedInGross(grossInrPaise, assumptions.gstPercent) : 0;
  return { grossInrPaise, processorFeeInrPaise, gstInrPaise, gstApplicable };
}

function emptyLine(row: PaymentRow): PaymentLine {
  return {
    row,
    status: 'review',
    studentId: null,
    creditMinor: 0,
    cashInrPaise: 0,
    processorFeeInrPaise: 0,
    gstInrPaise: 0,
    reasons: [],
    candidates: [],
    evidence: '',
    resolution: null,
  };
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS;
  const resolutions = input.resolutions ?? [];
  const students = input.students;
  const payments = input.payments;

  const resolutionsByPayment = new Map(resolutions.map((r) => [r.paymentId, r]));
  const studentsById = new Map(students.map((s) => [s.studentId, s]));
  const duplicates = detectDuplicateRows(payments);

  const lines: PaymentLine[] = payments.map((row) => {
    const line = emptyLine(row);
    const resolution = resolutionsByPayment.get(row.paymentId) ?? null;
    line.resolution = resolution;

    // 1. Rows the importer could not even read.
    if (row.amountMinor === null) {
      line.reasons = [reason('UNPARSEABLE_AMOUNT', `amount "${row.amountRaw}" is not a number`)];
      line.evidence = 'unparseable amount';
      return line;
    }
    if (row.currency === null) {
      line.reasons = [reason('UNKNOWN_CURRENCY', `currency "${row.currencyRaw}" is not supported`)];
      line.evidence = 'unsupported currency';
      return line;
    }
    if (!isIsoDate(row.date)) {
      line.reasons = [reason('INVALID_DATE', `date "${row.date}" is not a calendar date`)];
      line.evidence = 'invalid date';
      return line;
    }

    // 2. A recorded human decision always wins over the automatic verdict.
    if (resolution) {
      if (resolution.action === 'duplicate') {
        line.status = 'duplicate';
        line.reasons = [reason('DUPLICATE_ROW', `marked duplicate by ${resolution.decidedBy}`)];
        line.evidence = 'admin decision: duplicate';
        return line;
      }
      if (resolution.action === 'hold') {
        line.status = 'review';
        line.reasons = [reason('HELD_BY_ADMIN', `held for review by ${resolution.decidedBy}`)];
        line.candidates = findCandidates(row, students);
        line.evidence = 'admin decision: hold';
        return line;
      }
      if (resolution.action === 'unallocated') {
        const effects = moneyEffects(row, Math.abs(row.amountMinor), row.currency, null, assumptions);
        line.status = 'unallocated';
        line.cashInrPaise = effects.grossInrPaise;
        line.processorFeeInrPaise = effects.processorFeeInrPaise;
        line.reasons = [
          reason('NO_MATCHING_STUDENT', `admin decided this is real cash with no student to credit`),
        ];
        line.evidence = 'admin decision: unallocated cash';
        return line;
      }
      if (resolution.action === 'accept_refund') {
        const effects = moneyEffects(row, row.amountMinor, row.currency, null, assumptions);
        const candidates = findCandidates(row, students);
        const strong = candidates.filter((candidate) => candidate.confidence === 'strong');
        line.status = 'refund';
        line.cashInrPaise = effects.grossInrPaise;
        line.candidates = candidates;
        line.reasons = [reason('REFUND_ROW', `refund approved by ${resolution.decidedBy}`)];
        if (strong.length === 1) {
          // The refund reverses cash and the student credit it once carried.
          line.studentId = strong[0].studentId;
          line.creditMinor = row.amountMinor;
        } else {
          line.reasons.push(
            reason(
              'AMBIGUOUS_IDENTITY',
              'refund reduces cash, but no single student could be identified to reverse credit',
            ),
          );
        }
        line.evidence = 'admin decision: approved refund';
        return line;
      }
      if (resolution.action === 'assign') {
        const student = resolution.studentId ? studentsById.get(resolution.studentId) : undefined;
        if (!student) {
          line.reasons = [
            reason('NO_MATCHING_STUDENT', `admin assigned to "${resolution.studentId ?? ''}", which is not a student`),
          ];
          line.candidates = findCandidates(row, students);
          line.evidence = 'assignment target missing';
          return line;
        }
        line.candidates = [
          {
            studentId: student.studentId,
            name: student.name,
            email: student.email,
            confidence: 'strong',
            evidence: `assigned by ${resolution.decidedBy}`,
          },
        ];
        if (student.currency !== row.currency && !resolution.allowCrossCurrency) {
          line.studentId = student.studentId;
          line.reasons = [
            reason(
              'CURRENCY_MISMATCH',
              `payment is in ${row.currency}, student is billed in ${student.currency}; assign again with cross-currency approval`,
            ),
          ];
          line.evidence = 'assignment blocked: currency mismatch';
          return line;
        }
        if (student.currency !== row.currency) {
          // Explicitly accepted conversion at the fixed exercise rate.
          line.creditMinor = Math.round(
            (row.amountMinor * assumptions.inrPerUnit[row.currency]) / assumptions.inrPerUnit[student.currency],
          );
          line.reasons.push(
            reason(
              'CROSS_CURRENCY_ACCEPTED',
              `converted ${row.currency} to ${student.currency} at the fixed rate by ${resolution.decidedBy}`,
            ),
          );
        } else {
          line.creditMinor = row.amountMinor;
        }
        const effects = moneyEffects(row, row.amountMinor, row.currency, student.country, assumptions);
        line.status = 'credited';
        line.studentId = student.studentId;
        line.cashInrPaise = effects.grossInrPaise;
        line.processorFeeInrPaise = effects.processorFeeInrPaise;
        line.gstInrPaise = effects.gstInrPaise;
        line.evidence = `assigned by ${resolution.decidedBy}`;
        return line;
      }
    }

    // 3. Exact duplicate of an earlier row: real export artefact, counted once.
    const originalId = duplicates.get(row.paymentId);
    if (originalId) {
      line.status = 'duplicate';
      line.reasons = [
        reason(
          'DUPLICATE_ROW',
          `identical payer, date, amount and reference to ${originalId}; counted once`,
        ),
      ];
      line.evidence = `duplicate of ${originalId}`;
      return line;
    }

    // 4. Refunds are never inferred. They wait for approval.
    if (row.amountMinor < 0) {
      line.status = 'review';
      line.reasons = [
        reason('REFUND_ROW', `negative amount (${row.amountRaw}); refunds need approval before they affect cash`),
      ];
      line.candidates = findCandidates(row, students);
      line.evidence = 'unapproved refund row';
      return line;
    }

    // 5. Anything dated after the as-of date is excluded from today's numbers.
    if (daysBetween(assumptions.asOf, row.date) > 0) {
      line.status = 'future';
      line.reasons = [
        reason(
          'FUTURE_DATED',
          `dated ${row.date}, after the as-of date ${assumptions.asOf}; excluded from balances and receipts`,
        ),
      ];
      line.candidates = findCandidates(row, students);
      line.evidence = 'future-dated payment';
      return line;
    }

    // 6. Identity: exact evidence only.
    const candidates = findCandidates(row, students);
    line.candidates = candidates;
    const strong = candidates.filter((candidate) => candidate.confidence === 'strong');

    if (strong.length === 0) {
      line.status = 'review';
      line.reasons = [
        reason(
          'NO_MATCHING_STUDENT',
          candidates.length > 0
            ? 'no exact email or name match; the first-name hint needs a human'
            : 'no student record matches this payer',
        ),
      ];
      line.evidence = 'no exact match';
      return line;
    }

    if (strong.length > 1) {
      const byEmail = strong.filter((c) => normalize(row.payerEmail) === normalize(c.email));
      const byName = strong.filter((c) => !byEmail.includes(c));
      const conflicting = byEmail.length > 0 && byName.length > 0;
      line.status = 'review';
      line.reasons = [
        conflicting
          ? reason('CONFLICTING_EVIDENCE', 'the payer email and payer name point at different students')
          : reason('AMBIGUOUS_IDENTITY', 'more than one student record matches this payment'),
      ];
      line.evidence = 'ambiguous identity';
      return line;
    }

    const student = studentsById.get(strong[0].studentId)!;
    line.studentId = student.studentId;

    if (student.currency !== row.currency) {
      line.status = 'review';
      line.reasons = [
        reason(
          'CURRENCY_MISMATCH',
          `payment is in ${row.currency} but ${student.name} is billed in ${student.currency}`,
        ),
      ];
      line.evidence = 'currency mismatch';
      return line;
    }

    const effects = moneyEffects(row, row.amountMinor, row.currency, student.country, assumptions);
    line.status = 'credited';
    line.creditMinor = row.amountMinor;
    line.cashInrPaise = effects.grossInrPaise;
    line.processorFeeInrPaise = effects.processorFeeInrPaise;
    line.gstInrPaise = effects.gstInrPaise;
    line.evidence = strong[0].evidence;
    return line;
  });

  // --- Per-student accounts -------------------------------------------------
  const linesByStudent = new Map<string, PaymentLine[]>();
  for (const line of lines) {
    if (!line.studentId) continue;
    const list = linesByStudent.get(line.studentId) ?? [];
    list.push(line);
    linesByStudent.set(line.studentId, list);
  }

  const review: ReviewItem[] = [];

  const accounts: StudentAccount[] = students.map((student) => {
    const studentLines = (linesByStudent.get(student.studentId) ?? []).sort(
      (a, b) => a.row.date.localeCompare(b.row.date) || a.row.paymentId.localeCompare(b.row.paymentId),
    );
    const rawCredit = studentLines
      .filter((line) => line.status === 'credited' || line.status === 'refund')
      .reduce((sum, line) => sum + line.creditMinor, 0);

    const creditedMinor = Math.max(0, Math.min(rawCredit, student.courseFeeMinor));
    const overpaymentCreditMinor = Math.max(0, rawCredit - student.courseFeeMinor);

    const schedule = buildSchedule(student, assumptions);
    const instalments = allocateToSchedule(schedule, creditedMinor, assumptions.asOf, assumptions);

    const overdueMinor = overdueMinorOf(instalments);
    const futureMinor = futureMinorOf(instalments);
    const balanceMinor = student.courseFeeMinor - creditedMinor;
    const daysOverdue = daysOverdueOf(instalments, assumptions.asOf, assumptions);

    let status: StudentAccount['status'];
    if (overdueMinor > 0) status = 'overdue';
    else if (overpaymentCreditMinor > 0) status = 'credit';
    else if (balanceMinor > 0) status = 'due';
    else status = 'paid';

    return {
      student,
      instalments,
      creditedMinor,
      balanceMinor,
      overpaymentCreditMinor,
      overdueMinor,
      daysOverdue,
      futureMinor,
      status,
      reminderHeld: false,
      holdReasons: [],
      lines: studentLines,
    };
  });

  const accountsById = new Map(accounts.map((account) => [account.student.studentId, account]));

  // --- Review queue ---------------------------------------------------------
  for (const line of lines) {
    const isOpenReview = line.status === 'review';
    const isAutoDuplicate = line.status === 'duplicate';
    if (!isOpenReview && !isAutoDuplicate && !line.resolution) continue;

    const row = line.row;
    const effects =
      row.currency && row.amountMinor !== null
        ? moneyEffects(row, row.amountMinor, row.currency, null, assumptions)
        : null;

    let cashTreatment: string;
    let creditTreatment: string;
    let allowedActions: ReviewItem['allowedActions'];

    if (line.status === 'duplicate') {
      const original = duplicates.get(row.paymentId);
      cashTreatment = original ? `Not counted again - the cash is already on ${original}` : 'Not counted';
      creditTreatment = 'No student credit applied';
      allowedActions = ['assign', 'hold'];
    } else if (line.status === 'unallocated') {
      cashTreatment = effects ? `Counted as unallocated cash (${formatMoney(effects.grossInrPaise, 'INR')})` : 'Not counted';
      creditTreatment = 'No student credit applied';
      allowedActions = ['assign'];
    } else if (line.status === 'refund') {
      cashTreatment = effects ? `Reduces cash by ${formatMoney(Math.abs(effects.grossInrPaise), 'INR')}` : 'Not counted';
      creditTreatment = 'Reduces student credit by the refunded amount';
      allowedActions = ['hold'];
    } else if (line.status === 'credited') {
      cashTreatment = effects
        ? `Counted: ${formatMoney(effects.grossInrPaise, 'INR')} gross, ${formatMoney(effects.processorFeeInrPaise, 'INR')} PayPal fee`
        : 'Counted';
      creditTreatment = `${formatMoney(line.creditMinor, row.currency!)} credited`;
      allowedActions = ['hold'];
    } else {
      cashTreatment = 'Not counted yet - held until reviewed';
      creditTreatment = 'No student credit applied';
      allowedActions = line.reasons.some((r) => r.code === 'REFUND_ROW')
        ? ['accept_refund', 'hold']
        : ['assign', 'unallocated', 'hold'];
    }

    const status: ReviewItem['status'] = line.resolution
      ? line.status === 'review'
        ? 'open'
        : 'resolved'
      : line.status === 'duplicate'
        ? 'auto_resolved'
        : 'open';

    review.push({
      paymentId: row.paymentId,
      sourceRow: row.sourceRow,
      date: row.date,
      payerName: row.payerName,
      payerEmail: row.payerEmail,
      amountRaw: row.amountRaw,
      currencyRaw: row.currencyRaw,
      method: row.method,
      reference: row.reference,
      note: row.note,
      reasons: line.reasons,
      candidates: line.candidates,
      cashTreatment,
      creditTreatment,
      allowedActions,
      status,
      resolution: line.resolution,
    });

    // An open item that could belong to a student holds that student's reminder.
    if (status === 'open' || status === 'auto_resolved') {
      for (const candidate of line.candidates) {
        const account = accountsById.get(candidate.studentId);
        if (!account || status === 'auto_resolved') continue;
        account.reminderHeld = true;
        const blockedBy = line.reasons[0]?.message ?? 'unresolved payment';
        const reasonText = `${row.paymentId} (${row.currencyRaw} ${row.amountRaw} on ${row.date}): ${blockedBy}`;
        if (!account.holdReasons.includes(reasonText)) account.holdReasons.push(reasonText);
      }
    }
  }

  // --- Cash receipts for the as-of month -----------------------------------
  const month = assumptions.asOf.slice(0, 7);
  const receiptLines = lines.filter(
    (line) =>
      line.row.date.startsWith(month) &&
      (line.status === 'credited' || line.status === 'unallocated' || line.status === 'refund'),
  );
  const grossInrPaise = receiptLines.reduce((sum, l) => sum + l.cashInrPaise, 0);
  const processorFeesInrPaise = receiptLines.reduce((sum, l) => sum + l.processorFeeInrPaise, 0);
  const gstInrPaise = receiptLines.reduce((sum, l) => sum + l.gstInrPaise, 0);
  const gstApplicableGrossInrPaise = receiptLines
    .filter((l) => l.gstInrPaise > 0)
    .reduce((sum, l) => sum + l.cashInrPaise, 0);

  const receipts: ReceiptsSummary = {
    month,
    grossInrPaise,
    processorFeesInrPaise,
    netInrPaise: grossInrPaise - processorFeesInrPaise,
    gstInrPaise,
    gstApplicableGrossInrPaise,
    lines: receiptLines,
  };

  // --- Totals --------------------------------------------------------------
  const totals: Totals = {
    totalAgreedFeeInrPaise: accounts.reduce(
      (sum, a) => sum + toInrPaise(a.student.courseFeeMinor, a.student.currency, assumptions),
      0,
    ),
    totalCreditedInrPaise: accounts.reduce(
      (sum, a) => sum + toInrPaise(a.creditedMinor, a.student.currency, assumptions),
      0,
    ),
    totalBalanceInrPaise: accounts.reduce(
      (sum, a) => sum + toInrPaise(a.balanceMinor, a.student.currency, assumptions),
      0,
    ),
    totalOverdueInrPaise: accounts.reduce(
      (sum, a) => sum + toInrPaise(a.overdueMinor, a.student.currency, assumptions),
      0,
    ),
    totalOverpaymentCreditInrPaise: accounts.reduce(
      (sum, a) => sum + toInrPaise(a.overpaymentCreditMinor, a.student.currency, assumptions),
      0,
    ),
    totalUnallocatedCashInrPaise: lines
      .filter((l) => l.status === 'unallocated')
      .reduce((sum, l) => sum + l.cashInrPaise, 0),
    totalFutureInrPaise: accounts.reduce(
      (sum, a) => sum + toInrPaise(a.futureMinor, a.student.currency, assumptions),
      0,
    ),
  };

  // --- Reminder drafts -----------------------------------------------------
  const reminders: ReminderDraft[] = accounts
    .filter((account) => account.overdueMinor > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || a.student.studentId.localeCompare(b.student.studentId))
    .map((account) => {
      const oldestUnpaid = account.instalments
        .filter((i) => i.paidMinor < i.amountMinor && daysBetween(i.dueDate, assumptions.asOf) > 0)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const firstName = account.student.name.split(' ')[0];
      const amount = formatMoney(account.overdueMinor, account.student.currency);
      const message =
        `Hi ${firstName}, this is Nathaniel School of Music. ` +
        `${amount} for ${account.student.course} is still pending` +
        (oldestUnpaid ? ` (due ${formatDate(oldestUnpaid.dueDate)})` : '') +
        `. Could you let us know when you can send it? Thank you.`;
      return {
        studentId: account.student.studentId,
        studentName: account.student.name,
        currency: account.student.currency,
        overdueMinor: account.overdueMinor,
        daysOverdue: account.daysOverdue,
        phone: null,
        message,
        held: account.reminderHeld,
        holdReasons: account.holdReasons,
      };
    });

  const inputFingerprint = fingerprint(
    JSON.stringify({
      asOf: assumptions.asOf,
      assumptions,
      students: [...students]
        .sort((a, b) => a.studentId.localeCompare(b.studentId))
        .map((s) => [s.studentId, s.name, s.email, s.country, s.startDate, s.plan, s.currency, s.courseFeeMinor]),
      payments: [...payments]
        .sort((a, b) => a.paymentId.localeCompare(b.paymentId))
        .map((p) => [p.paymentId, p.date, p.amountMinor, p.currency, p.payerEmail, p.reference]),
      resolutions: [...resolutions]
        .sort((a, b) => a.paymentId.localeCompare(b.paymentId))
        .map((r) => [r.paymentId, r.action, r.studentId ?? '', r.allowCrossCurrency ?? false]),
    }),
  );

  return {
    asOf: assumptions.asOf,
    generatedAt: new Date().toISOString(),
    students: accounts,
    payments: lines,
    review,
    receipts,
    totals,
    reminders,
    inputFingerprint,
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
