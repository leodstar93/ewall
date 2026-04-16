# IFTA Automation Module

Current status: the provider-agnostic IFTA automation backend has been rebuilt around canonical filings, snapshots, and a Motive-first adapter.

If your local database already applied the old IFTA v2 migrations, reset that database or manually drop the old ELD / IFTA v2 tables before introducing the new schema.

## Target direction

- Motive-first, provider-agnostic backend.
- OAuth-based provider connections.
- Immutable raw ingestion layer.
- Canonical filing tables separate from provider payloads.
- Quarterly filing workflow from trucker to staff to frozen snapshot.
- Snapshot-based auditability and exports.

## Implemented services

- `ProviderConnectionService`
- `ELDProviderRegistry`
- `MotiveAdapter`
- `SyncOrchestrator`
- `RawIngestionService`
- `CanonicalNormalizationService`
- `IftaCalculationEngine`
- `IftaExceptionEngine`
- `FilingWorkflowService`
- `SnapshotService`
- `ExportService`

## Implemented routes

- `POST /api/v1/integrations/eld/connect`
- `GET /api/v1/integrations/eld/providers`
- `GET /api/v1/integrations/eld/callback/motive`
- `POST /api/v1/integrations/eld/disconnect`
- `GET /api/v1/integrations/eld/status`
- `POST /api/v1/integrations/eld/webhooks/motive`
- `POST /api/v1/features/ifta-v2/integrations/sync`
- `GET /api/v1/features/ifta-v2/integrations/sync-jobs`
- `GET /api/v1/features/ifta-v2/filings`
- `POST /api/v1/features/ifta-v2/filings`
- `GET /api/v1/features/ifta-v2/filings/[id]`
- `POST /api/v1/features/ifta-v2/filings/[id]/rebuild`
- `POST /api/v1/features/ifta-v2/filings/[id]/recalculate`
- `POST /api/v1/features/ifta-v2/filings/[id]/submit`
- `POST /api/v1/features/ifta-v2/filings/[id]/request-changes`
- `POST /api/v1/features/ifta-v2/filings/[id]/create-snapshot`
- `POST /api/v1/features/ifta-v2/filings/[id]/approve`
- `POST /api/v1/features/ifta-v2/filings/[id]/reopen`
- `GET /api/v1/features/ifta-v2/filings/[id]/exceptions`
- `GET /api/v1/features/ifta-v2/filings/[id]/download`
- `POST /api/v1/features/ifta-v2/exceptions/[id]/ack`
- `POST /api/v1/features/ifta-v2/exceptions/[id]/resolve`
- `POST /api/v1/features/ifta-v2/exceptions/[id]/ignore`

## Non-negotiable implementation rules

- Raw provider payloads stay immutable.
- Manual adjustments never overwrite raw data.
- All sync jobs must be idempotent.
- Approved filings stay frozen until explicit reopen.
- Snapshot history is never deleted or mutated after freeze.

## Environment TODOs

- Set `NEXT_PUBLIC_APP_URL` or `NEXTAUTH_URL` so OAuth callback URLs can be generated server-side.
- Set `MOTIVE_CLIENT_ID`, `MOTIVE_CLIENT_SECRET`, and whitelist `/api/v1/integrations/eld/callback/motive`.
- Confirm `MOTIVE_OAUTH_SCOPES` with your Motive app approval.
- Keep `companies.read` enabled so the callback can identify the Motive company and block accidental cross-client links.
- `MOTIVE_OAUTH_PROMPT=login` and `MOTIVE_OAUTH_MAX_AGE=0` ask Motive for a fresh login during each connect.
- Motive may still reuse an active browser session, so OAuth callbacks are saved as `PENDING` until the user confirms the returned Motive company in EWALL.
- Set `MOTIVE_WEBHOOK_SECRET` before accepting signed webhooks in production.
- Prefer dedicated `ELD_ENCRYPTION_KEY_*` and `ELD_OAUTH_STATE_SECRET` values instead of relying on the `AUTH_SECRET` fallback.

## Future SamsaraAdapter Notes

- Keep the canonical filing tables unchanged. Add Samsara-specific field mapping only inside a new adapter.
- Reuse `IntegrationAccount`, `SyncOrchestrator`, `RawIngestionService`, `CanonicalNormalizationService`, `IftaCalculationEngine`, `IftaExceptionEngine`, `SnapshotService`, and `ExportService`.
- Mirror the Motive adapter contract:
  - OAuth URL build and callback exchange
  - access-token refresh
  - vehicles/drivers sync
  - jurisdiction mileage sync
  - fuel purchase sync
  - optional webhook verification
- Add any Samsara-specific report shape mapping in the adapter layer only. Do not couple filing calculation or snapshots to provider response formats.
