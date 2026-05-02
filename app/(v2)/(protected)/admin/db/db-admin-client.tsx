"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

function OutputBlock({ output }: { output: string }) {
  if (!output) return null;
  return (
    <pre
      style={{
        marginTop: 12,
        padding: "12px 14px",
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      {output}
    </pre>
  );
}

function ActionCard({
  title,
  description,
  buttonLabel,
  buttonColor,
  status,
  output,
  onRun,
  dangerous,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  buttonColor: string;
  status: Status;
  output: string;
  onRun: () => void;
  dangerous?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = () => {
    if (dangerous && !confirmed) {
      setConfirmed(true);
      return;
    }
    setConfirmed(false);
    onRun();
  };

  const isLoading = status === "loading";

  return (
    <div
      style={{
        border: `1px solid ${dangerous ? "#fca5a5" : "var(--br)"}`,
        borderRadius: 12,
        padding: "20px 24px",
        background: dangerous ? "#fff5f5" : "#fff",
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 15, color: "var(--b)" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
        {description}
      </div>

      {confirmed && dangerous && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            fontSize: 13,
            color: "#b91c1c",
            fontWeight: 500,
          }}
        >
          This will permanently delete all data. Click again to confirm.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={handleClick}
          disabled={isLoading}
          style={{
            padding: "8px 18px",
            background: isLoading ? "#94a3b8" : buttonColor,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "opacity 0.15s",
          }}
        >
          {isLoading ? "Running…" : confirmed && dangerous ? "Confirm Reset" : buttonLabel}
        </button>

        {confirmed && dangerous && (
          <button
            onClick={() => setConfirmed(false)}
            style={{
              padding: "8px 14px",
              background: "transparent",
              color: "#64748b",
              border: "1px solid var(--br)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}

        {status === "success" && (
          <span style={{ fontSize: 13, color: "#047857", fontWeight: 500 }}>Done</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>Failed</span>
        )}
      </div>

      <OutputBlock output={output} />
    </div>
  );
}

export default function DbAdminClient() {
  const [seedStatus, setSeedStatus] = useState<Status>("idle");
  const [seedOutput, setSeedOutput] = useState("");
  const [resetStatus, setResetStatus] = useState<Status>("idle");
  const [resetOutput, setResetOutput] = useState("");

  async function runAction(
    action: "seed" | "reset",
    setStatus: (s: Status) => void,
    setOutput: (o: string) => void,
  ) {
    setStatus("loading");
    setOutput("");
    try {
      const res = await fetch("/api/v1/admin/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok?: boolean; output?: string; error?: string };
      setOutput(data.output ?? data.error ?? "");
      setStatus(data.ok ? "success" : "error");
    } catch (err) {
      setOutput(String(err));
      setStatus("error");
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--b)", margin: 0 }}>
          Database
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6, marginBottom: 0 }}>
          Run seed and reset operations against the database.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ActionCard
          title="Seed Database"
          description="Runs the Prisma seed script (prisma/seed.ts). Inserts default roles, permissions, admin user, and any fixture data without dropping existing rows."
          buttonLabel="Run Seed"
          buttonColor="#1d4ed8"
          status={seedStatus}
          output={seedOutput}
          onRun={() => void runAction("seed", setSeedStatus, setSeedOutput)}
        />

        <ActionCard
          title="Reset Database"
          description="Drops all data, re-applies every migration from scratch, then runs the seed. All existing records will be permanently deleted."
          buttonLabel="Reset DB"
          buttonColor="#b91c1c"
          status={resetStatus}
          output={resetOutput}
          onRun={() => void runAction("reset", setResetStatus, setResetOutput)}
          dangerous
        />
      </div>
    </div>
  );
}
