const IFTA_AUTOMATION_SPEC_DOC = "/docs/ifta-automation-module.md";

type ResetRouteInput = {
  route: string;
  methods: string[];
  notes?: string[];
};

export function buildIftaAutomationResetPayload(input: ResetRouteInput) {
  return {
    status: "not_implemented",
    module: "IFTA_AUTOMATION",
    route: input.route,
    methods: input.methods,
    message:
      "The previous IFTA automation implementation was removed. Rebuild this route from the new Motive-first, provider-agnostic spec.",
    specDoc: IFTA_AUTOMATION_SPEC_DOC,
    notes:
      input.notes ?? [
        "Keep provider raw data immutable.",
        "Make sync operations idempotent and retry-safe.",
        "Do not recalculate approved filings automatically.",
        "Freeze approved snapshots as immutable versions.",
      ],
  };
}

export function iftaAutomationNotImplemented(input: ResetRouteInput) {
  return Response.json(buildIftaAutomationResetPayload(input), { status: 501 });
}
