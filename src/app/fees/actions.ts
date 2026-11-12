'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db';
import type { ResolutionAction } from '@/lib/finance/types';

const ACTIONS: ResolutionAction[] = ['assign', 'duplicate', 'unallocated', 'accept_refund', 'hold'];

/** Record the admin's decision on one payment row, then re-derive the page. */
export async function resolvePayment(formData: FormData): Promise<void> {
  const paymentId = String(formData.get('paymentId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim() as ResolutionAction;

  if (!paymentId) return;
  if (!ACTIONS.includes(action)) return;

  const studentIdRaw = String(formData.get('studentId') ?? '').trim();
  const studentId = studentIdRaw || undefined;
  if (action === 'assign' && !studentId) return;

  const store = await getStore();
  await store.saveResolution({
    paymentId,
    action,
    studentId,
    allowCrossCurrency: formData.get('allowCrossCurrency') === 'on',
    note: String(formData.get('note') ?? '') || undefined,
    decidedBy: String(formData.get('decidedBy') ?? 'admin@desk'),
    decidedAt: new Date().toISOString(),
  });

  revalidatePath('/fees');
  if (studentId) revalidatePath(`/fees/students/${studentId}`);
}

/** Undo a decision and let the automatic verdict apply again. */
export async function undoResolution(formData: FormData): Promise<void> {
  const paymentId = String(formData.get('paymentId') ?? '').trim();
  if (!paymentId) return;

  const store = await getStore();
  await store.clearResolution(paymentId, 'admin@desk');
  revalidatePath('/fees');
}
