export type LabMetric = {
  label: string;
  value: string;
};

export type LabSignal = {
  label: string;
  value: string;
  note: string;
};

export type LabModule = {
  slug: string;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  currentHref: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  metrics: LabMetric[];
  signals: LabSignal[];
  workflow: string[];
  checklist: string[];
};

export const labHeroMetrics: LabMetric[] = [
  {
    label: "Workspace",
    value: "Fully isolated",
  },
  {
    label: "Routes",
    value: "/v2 + module previews",
  },
  {
    label: "Intent",
    value: "Visual reset from zero",
  },
];

export const labPrinciples = [
  {
    title: "Industrial editorial",
    text: "Large condensed headlines, tighter spacing, and sharper hierarchy make the product feel more confident and operational.",
  },
  {
    title: "Warm surfaces",
    text: "The palette moves away from generic app chrome into sand, ink, orange, and teal to feel more distinctive without losing trust.",
  },
  {
    title: "Dashboard energy",
    text: "Cards, rails, and status strips are designed to feel alive and directional instead of flat admin panels.",
  },
];

export const labMilestones = [
  {
    step: "01",
    title: "Explore in parallel",
    text: "Use `/v2` as a sandbox without touching the live experience or the current component tree.",
  },
  {
    step: "02",
    title: "Scale module by module",
    text: "Each module page can evolve independently until the new language is stable enough to replace the old shell.",
  },
  {
    step: "03",
    title: "Swap only when ready",
    text: "Once the experiment feels solid, we can migrate the current routes into this system with much less risk.",
  },
];

export const labModules: LabModule[] = [
  {
    slug: "control-room",
    label: "Control Room",
    eyebrow: "Ops shell",
    title: "A command-center landing space for the whole product.",
    summary:
      "This preview turns the main dashboard into a more cinematic control room with stronger hierarchy, ambient panels, and clearer action clusters.",
    status: "Ready for shell experiments",
    currentHref: "/settings",
    accent: "#ff6b2c",
    accentSoft: "rgba(255, 107, 44, 0.18)",
    accentInk: "#8d360f",
    metrics: [
      { label: "Focus", value: "Primary shell" },
      { label: "Signals", value: "08 live cards" },
      { label: "Tone", value: "Warm industrial" },
    ],
    signals: [
      {
        label: "Navigation",
        value: "Reframed",
        note: "Quick links become a visual rail instead of a plain list.",
      },
      {
        label: "Headers",
        value: "Bolder",
        note: "Display typography leads the page before dense tables do.",
      },
      {
        label: "Scanning",
        value: "Faster",
        note: "Status cards and queue lanes surface the most important work first.",
      },
    ],
    workflow: [
      "Hero command surface with current priorities.",
      "Module strips for daily actions and deadlines.",
      "Deeper queue views for operations and compliance work.",
    ],
    checklist: [
      "Lock the new navigation language.",
      "Prototype responsive sidebar behavior.",
      "Define the card rhythm for all future modules.",
    ],
  },
  {
    slug: "ifta-v2",
    label: "IFTA Automation",
    eyebrow: "Core workflow",
    title: "A cleaner filing workspace for sync, review, and approval.",
    summary:
      "The IFTA preview leans into filing state, exception visibility, and clearer movement between raw data, jurisdiction lines, and approval steps.",
    status: "Best candidate for first redesign",
    currentHref: "/ifta-v2",
    accent: "#0e9a87",
    accentSoft: "rgba(14, 154, 135, 0.18)",
    accentInk: "#12534b",
    metrics: [
      { label: "Queue", value: "24 filings" },
      { label: "Exceptions", value: "03 critical" },
      { label: "Sync health", value: "97%" },
    ],
    signals: [
      {
        label: "Review flow",
        value: "Linear",
        note: "Submission, review, snapshot, and approval are staged more clearly.",
      },
      {
        label: "Auditability",
        value: "Visible",
        note: "Key events can be surfaced as a permanent rail instead of hidden text.",
      },
      {
        label: "Exceptions",
        value: "Action-first",
        note: "Blocking items are framed as tasks, not just warnings.",
      },
    ],
    workflow: [
      "Open or create a filing and verify sync coverage.",
      "Review distance, fuel lines, and blocking exceptions.",
      "Move the filing through submission, snapshot, and approval.",
    ],
    checklist: [
      "Design the filing hero state.",
      "Map manual fuel edits into the new card system.",
      "Create a reusable audit timeline component.",
    ],
  },
  {
    slug: "dmv",
    label: "DMV Hub",
    eyebrow: "Renewals and registrations",
    title: "A calmer operations board for state-by-state registration work.",
    summary:
      "This concept moves DMV work away from generic tables toward lane-based queues, requirement chips, and clearer service ownership.",
    status: "Good fit for queue redesign",
    currentHref: "/dmv",
    accent: "#3666ff",
    accentSoft: "rgba(54, 102, 255, 0.16)",
    accentInk: "#213b8a",
    metrics: [
      { label: "Open renewals", value: "19" },
      { label: "Pending docs", value: "11" },
      { label: "Avg cycle", value: "4.2 days" },
    ],
    signals: [
      {
        label: "Queues",
        value: "Lane based",
        note: "Ready, waiting, and client-action states become easier to scan.",
      },
      {
        label: "Requirements",
        value: "Visual",
        note: "Checklist density is managed with tags and grouped proof states.",
      },
      {
        label: "Ownership",
        value: "Explicit",
        note: "Staff assignment can sit beside the filing state instead of below it.",
      },
    ],
    workflow: [
      "Surface active renewals by urgency and missing requirements.",
      "Group state-specific friction into a dedicated detail rail.",
      "Move staff actions into one compact action strip.",
    ],
    checklist: [
      "Prototype renewal cards for desktop and mobile.",
      "Test requirement badges against long state names.",
      "Decide how status colors map across DMV and IFTA.",
    ],
  },
  {
    slug: "documents",
    label: "Document Dock",
    eyebrow: "Shared records",
    title: "A document area that feels like a curated archive instead of a file dump.",
    summary:
      "The document preview introduces shelves, larger metadata blocks, and stronger download or view actions for faster retrieval.",
    status: "Ready for visual identity work",
    currentHref: "/documents",
    accent: "#f0a81f",
    accentSoft: "rgba(240, 168, 31, 0.16)",
    accentInk: "#8a5f08",
    metrics: [
      { label: "Indexed", value: "1.2k files" },
      { label: "Shared", value: "04 teams" },
      { label: "Turnaround", value: "< 2 min" },
    ],
    signals: [
      {
        label: "Search",
        value: "Spotlight style",
        note: "Searching can feel more premium than a single input at the top of the page.",
      },
      {
        label: "Metadata",
        value: "Readable",
        note: "Dates, owners, and document types deserve stronger visual grouping.",
      },
      {
        label: "Actions",
        value: "One click",
        note: "Preview, download, and related filing links should be immediately visible.",
      },
    ],
    workflow: [
      "Open the shelf for the filing or organization context.",
      "Preview the most recent docs in a larger featured rail.",
      "Take direct actions without diving into nested tables.",
    ],
    checklist: [
      "Shape the new search surface.",
      "Design a document detail drawer.",
      "Test dense metadata on narrow screens.",
    ],
  },
];

export function getLabModuleBySlug(slug: string) {
  return labModules.find((module) => module.slug === slug);
}
