/**
 * Shared domain types for the fees engine.
 *
 * Money rule for this whole codebase: every monetary value is an integer in the
 * currency's minor unit (paise for INR, cents for USD/EUR). No floating point
 * arithmetic ever touches a balance.
 */

export type Currency = 'INR' | 'USD' | 'EUR';

export type Plan = 'full' | 'instalments';

/** One row of students.csv, already normalised. */
export interface Student {
  studentId: string;
  name: string;
  email: string;
  country: string;
  course: string;
  /** ISO date, YYYY-MM-DD. */
  startDate: string;
  plan: Plan;
  /** Raw plan text from the CSV, kept so the UI can show the original wording. */
  planRaw: string;
  currency: Currency;
  /** Course fee in minor units of `currency`. */
  courseFeeMinor: number;
  sourceRow: number;
}

/** One row of payments.csv, raw values preserved plus normalised values. */
export interface PaymentRow {
  paymentId: string;
  date: string;
  payerName: string;
  payerEmail: string;
  /** Raw currency text as exported, e.g. "INR". */
  currencyRaw: string;
  /** Raw amount text as exported, e.g. "5000" or "-15000". */
  amountRaw: string;
  currency: Currency | null;
  /** Amount in minor units, signed. Null when the raw amount does not parse. */
  amountMinor: number | null;
  method: string;
  reference: string;
  note: string;
  sourceRow: number;
}

export type ResolutionAction = 'assign' | 'duplicate' | 'unallocated' | 'accept_refund' | 'hold';

/** A human decision about one payment row. */
export interface Resolution {
  paymentId: string;
  action: ResolutionAction;
  /** Required for `assign`. */
  studentId?: string;
  /** Required when assigning a payment whose currency differs from the student's. */
  allowCrossCurrency?: boolean;
  note?: string;
  decidedBy: string;
  /** ISO timestamp. Recorded for the audit trail; never affects finance output. */
  decidedAt: string;
}

export type ReasonCode =
  | 'DUPLICATE_ROW'
  | 'AMBIGUOUS_IDENTITY'
  | 'NO_MATCHING_STUDENT'
  | 'CONFLICTING_EVIDENCE'
  | 'CURRENCY_MISMATCH'
  | 'REFUND_ROW'
  | 'FUTURE_DATED'
  | 'PARTIAL_PAYMENT'
  | 'OVERPAYMENT'
  | 'UNPARSEABLE_AMOUNT'
  | 'UNKNOWN_CURRENCY'
  | 'INVALID_DATE'
  | 'CROSS_CURRENCY_ACCEPTED'
  | 'HELD_BY_ADMIN';

export interface Reason {
  code: ReasonCode;
  /** Plain-English sentence shown to the admin. */
  message: string;
}

export type CandidateConfidence = 'strong' | 'weak';

export interface Candidate {
  studentId: string;
  name: string;
  email: string;
  confidence: CandidateConfidence;
  evidence: string;
}

export type LineStatus =
  | 'credited'
  | 'duplicate'
  | 'unallocated'
  | 'refund'
  | 'future'
  | 'review'
  | 'ignored';

/** The engine's verdict on a single payment row. */
export interface PaymentLine {
  row: PaymentRow;
  status: LineStatus;
  studentId: string | null;
  /** Credit applied to the student's fee, in the student's currency minor units. */
  creditMinor: number;
  /** Cash actually received, expressed in INR paise. Negative for refunds. */
  cashInrPaise: number;
  /** PayPal fee for this row, in INR paise (0 when not PayPal). */
  processorFeeInrPaise: number;
  /** GST included in this receipt, in INR paise (0 when not GST-applicable). */
  gstInrPaise: number;
  reasons: Reason[];
  candidates: Candidate[];
  /** Short machine-readable summary of why this status was chosen. */
  evidence: string;
  resolution: Resolution | null;
}

export type InstalmentStatus = 'paid' | 'partial' | 'due' | 'overdue' | 'future' | 'waived';

export interface Instalment {
  index: number;
  dueDate: string;
  amountMinor: number;
  paidMinor: number;
  status: InstalmentStatus;
}

export type AccountStatus = 'paid' | 'credit' | 'due' | 'overdue' | 'review';

export interface StudentAccount {
  student: Student;
  instalments: Instalment[];
  /** Total credit applied against the fee, minor units. Never exceeds the fee. */
  creditedMinor: number;
  /** fee - credited, floored at 0. */
  balanceMinor: number;
  /** credited - fee when positive: money held on account. */
  overpaymentCreditMinor: number;
  /** Sum of unsettled obligations whose due date is before the as-of date. */
  overdueMinor: number;
  /** Days between the oldest unsettled overdue due date and the as-of date. */
  daysOverdue: number;
  /** Sum of unsettled obligations due after the as-of date. */
  futureMinor: number;
  status: AccountStatus;
  /** True when an unresolved review item could change this student's numbers. */
  reminderHeld: boolean;
  holdReasons: string[];
  lines: PaymentLine[];
}

export interface ReceiptsSummary {
  month: string;
  /** Gross receipts converted to INR paise. */
  grossInrPaise: number;
  /** PayPal fees, INR paise. */
  processorFeesInrPaise: number;
  /** gross - processor fees. */
  netInrPaise: number;
  /** GST included in GST-applicable receipts. */
  gstInrPaise: number;
  /** Receipts that carry GST (India + INR). */
  gstApplicableGrossInrPaise: number;
  lines: PaymentLine[];
}

export interface ReviewItem {
  paymentId: string;
  sourceRow: number;
  date: string;
  payerName: string;
  payerEmail: string;
  amountRaw: string;
  currencyRaw: string;
  method: string;
  reference: string;
  note: string;
  reasons: Reason[];
  candidates: Candidate[];
  /** How the row is currently treated. */
  cashTreatment: string;
  creditTreatment: string;
  allowedActions: ResolutionAction[];
  status: 'open' | 'auto_resolved' | 'resolved';
  resolution: Resolution | null;
}

export interface ReminderDraft {
  studentId: string;
  studentName: string;
  currency: Currency;
  overdueMinor: number;
  daysOverdue: number;
  /** Student's own WhatsApp/phone field: not present in the source data. */
  phone: string | null;
  message: string;
  held: boolean;
  holdReasons: string[];
}

export interface Totals {
  totalAgreedFeeInrPaise: number;
  totalCreditedInrPaise: number;
  totalBalanceInrPaise: number;
  totalOverdueInrPaise: number;
  totalOverpaymentCreditInrPaise: number;
  totalUnallocatedCashInrPaise: number;
  totalFutureInrPaise: number;
}

export interface ReconcileResult {
  asOf: string;
  generatedAt: string;
  students: StudentAccount[];
  payments: PaymentLine[];
  review: ReviewItem[];
  receipts: ReceiptsSummary;
  totals: Totals;
  reminders: ReminderDraft[];
  /** Deterministic fingerprint of the financial inputs. */
  inputFingerprint: string;
}

export interface Assumptions {
  asOf: string;
  /** IANA zone used to interpret date-only values. Fixed for the exercise. */
  timeZone: string;
  /** INR per one major unit of each currency. */
  inrPerUnit: Record<Currency, number>;
  paypalPercent: number;
  /** Fixed PayPal fee, in the payment currency's minor units. */
  paypalFixedMinor: number;
  gstPercent: number;
  /** Countries treated as domestic for GST on receipts. */
  gstCountries: string[];
  /** Offset in days from start_date to the first instalment due date. */
  firstInstalmentOffsetDays: number;
  instalmentIntervalDays: number;
  /** When true, an obligation due exactly on the as-of date is already overdue. */
  overdueIncludesDueToday: boolean;
}
