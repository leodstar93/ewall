# UCR Concierge Coverage Points

Use these cases to validate the concierge workflow until automated request/service tests are added.

1. Create UCR draft
   Expected: `POST /api/v1/features/ucr` creates a `DRAFT` filing with `year`, `vehicleCount`, pricing fields, and `customerPaymentStatus = NOT_STARTED`.

2. Submit for payment and create pricing snapshot
   Expected: `POST /api/v1/features/ucr/:id/submit` creates or updates `UCRRateSnapshot` and transitions the filing to `AWAITING_CUSTOMER_PAYMENT`.

3. Start checkout
   Expected: `POST /api/v1/features/ucr/:id/checkout` creates a Stripe Checkout session, stores `stripeCheckoutSessionId`, sets `customerPaymentStatus = PENDING`, and transitions to `CUSTOMER_PAYMENT_PENDING`.

4. Stripe webhook success
   Expected: `POST /api/v1/webhooks/stripe` with `checkout.session.completed` marks `customerPaymentStatus = SUCCEEDED`, sets `customerPaidAt`, creates a `UCRWorkItem`, and transitions through `CUSTOMER_PAID` to `QUEUED_FOR_PROCESSING`.

5. Duplicate webhook delivery
   Expected: replaying the same successful webhook does not create duplicate work items or duplicate payment state updates.

6. Staff claim and start processing
   Expected: `POST /api/v1/admin/ucr/:id/claim` assigns the filing and claims the work item, then `POST /api/v1/admin/ucr/:id/start-processing` transitions to `IN_PROCESS` and marks the work item `PROCESSING`.

7. Staff upload receipt
   Expected: `POST /api/v1/admin/ucr/:id/receipt` accepts PDF/PNG/JPG/JPEG/WEBP, stores receipt metadata on the filing, and creates a `UCRDocument` row with `OFFICIAL_RECEIPT`.

8. Staff mark official paid
   Expected: `POST /api/v1/admin/ucr/:id/official-paid` requires receipt metadata, sets `officialPaymentStatus = PAID`, stores `officialPaidAt`, and transitions to `OFFICIAL_PAID`.

9. Staff complete filing
   Expected: `POST /api/v1/admin/ucr/:id/complete` succeeds only after customer payment, official payment, and receipt prerequisites are present, then sets `completedAt`, marks the work item `DONE`, and returns the filing to the customer as `COMPLETED`.

10. Invalid completion without receipt
    Expected: completing without `officialReceiptUrl`, `officialPaidAt`, or `officialReceiptNumber` / `officialConfirmation` returns a validation error and leaves the status unchanged.

11. Permission denial on unauthorized routes
    Expected: owner-only customer routes reject other users, and staff/admin routes reject users without the matching `ucr:*` permission.
