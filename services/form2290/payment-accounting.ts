import { Form2290PaymentStatus, Prisma } from "@prisma/client";

const MONEY_EPSILON = 0.005;

function toMoneyNumber(value: unknown) {
  if (value == null || value === "") return 0;
  const numeric =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

export function decimalFromMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export function get2290TotalAmount(input: {
  amountDue?: unknown;
  serviceFeeAmount?: unknown;
}) {
  return Number(
    (toMoneyNumber(input.amountDue) + toMoneyNumber(input.serviceFeeAmount)).toFixed(2),
  );
}

export function get2290PaymentAccounting(input: {
  amountDue?: unknown;
  serviceFeeAmount?: unknown;
  paymentStatus?: Form2290PaymentStatus | string | null;
  customerPaidAmount?: unknown;
}) {
  const totalAmount = get2290TotalAmount(input);
  const storedPaidAmount = toMoneyNumber(input.customerPaidAmount);
  const paidAmount =
    storedPaidAmount > MONEY_EPSILON ||
    input.paymentStatus === Form2290PaymentStatus.PAID ||
    input.paymentStatus === Form2290PaymentStatus.RECEIVED ||
    input.paymentStatus === Form2290PaymentStatus.WAIVED
      ? storedPaidAmount || totalAmount
      : 0;
  const balanceDue = Number(Math.max(totalAmount - paidAmount, 0).toFixed(2));
  const creditAmount = Number(Math.max(paidAmount - totalAmount, 0).toFixed(2));

  return {
    totalAmount,
    paidAmount,
    balanceDue,
    creditAmount,
    hasAnyPayment: paidAmount > MONEY_EPSILON,
    isSettled: balanceDue <= MONEY_EPSILON,
  };
}

export function build2290PaymentAccountingUpdate(input: {
  amountDue?: unknown;
  serviceFeeAmount?: unknown;
  paymentStatus?: Form2290PaymentStatus | string | null;
  customerPaidAmount?: unknown;
}) {
  const accounting = get2290PaymentAccounting(input);
  const fallbackStatus =
    (input.paymentStatus as Form2290PaymentStatus | null | undefined) ??
    Form2290PaymentStatus.UNPAID;
  const paymentStatus =
    accounting.hasAnyPayment || fallbackStatus === Form2290PaymentStatus.PAID
      ? accounting.isSettled
        ? Form2290PaymentStatus.PAID
        : Form2290PaymentStatus.PENDING
      : fallbackStatus;

  return {
    ...accounting,
    paymentStatus,
    data: {
      customerPaidAmount: decimalFromMoney(accounting.paidAmount),
      customerBalanceDue: decimalFromMoney(accounting.balanceDue),
      customerCreditAmount: decimalFromMoney(accounting.creditAmount),
      paymentStatus,
    },
  };
}
