import type { AppEnvironment } from "@/lib/db/types";

export type NotificationProvider = {
  sendEmail(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void>;
};

export type PaymentProvider = {
  charge(input: {
    amountCents: number;
    currency: string;
    referenceId: string;
  }): Promise<{ status: "succeeded" | "mocked"; transactionId: string }>;
};

export type EldImportProvider = {
  importTrips(input: {
    carrierId: string;
    periodKey: string;
  }): Promise<{ status: "imported" | "mocked"; tripsImported: number }>;
};

const prodNotificationProvider: NotificationProvider = {
  async sendEmail() {
    // Existing production mailers remain the primary implementation path today.
    // TODO: centralize all email sending through this provider and route through lib/email.ts.
  },
};

const sandboxNotificationProvider: NotificationProvider = {
  async sendEmail(input) {
    const redirectTarget = process.env.SANDBOX_EMAIL_REDIRECT_TO?.trim();

    if (!redirectTarget) {
      console.warn("Sandbox email blocked because SANDBOX_EMAIL_REDIRECT_TO is not set.", {
        originalRecipient: input.to,
        subject: input.subject,
      });
      return;
    }

    console.warn("Sandbox email redirected.", {
      originalRecipient: input.to,
      redirectedTo: redirectTarget,
      subject: input.subject,
    });
  },
};

const prodPaymentProvider: PaymentProvider = {
  async charge(input) {
    // TODO: wire the real billing gateway here when payment abstraction is introduced.
    return {
      status: "succeeded",
      transactionId: `prod_${input.referenceId}`,
    };
  },
};

const sandboxPaymentProvider: PaymentProvider = {
  async charge(input) {
    // TODO: replace this with a richer mock ledger once sandbox billing flows are implemented.
    return {
      status: "mocked",
      transactionId: `sandbox_${input.referenceId}`,
    };
  },
};

const prodEldImportProvider: EldImportProvider = {
  async importTrips() {
    // TODO: connect the real ELD adapter here behind the shared provider interface.
    return {
      status: "imported",
      tripsImported: 0,
    };
  },
};

const sandboxEldImportProvider: EldImportProvider = {
  async importTrips() {
    // TODO: serve deterministic JSON fixtures for sandbox ELD imports.
    return {
      status: "mocked",
      tripsImported: 0,
    };
  },
};

export function getExternalProviders(environment: AppEnvironment) {
  if (environment === "sandbox") {
    return {
      notifications: sandboxNotificationProvider,
      payments: sandboxPaymentProvider,
      eld: sandboxEldImportProvider,
    };
  }

  return {
    notifications: prodNotificationProvider,
    payments: prodPaymentProvider,
    eld: prodEldImportProvider,
  };
}
