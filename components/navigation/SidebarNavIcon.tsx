import { SVGProps } from "react";

export type SidebarIconName =
  | "calendar"
  | "chart"
  | "clipboard"
  | "cube"
  | "dashboard"
  | "document"
  | "folder"
  | "layout"
  | "mail"
  | "receipt"
  | "settings"
  | "shield"
  | "stack"
  | "table"
  | "users";

type ResolveSidebarIconInput = {
  href?: string;
  label?: string;
  section?: string;
};

function textForMatch({ href, label, section }: ResolveSidebarIconInput) {
  return `${href ?? ""} ${label ?? ""} ${section ?? ""}`.toLowerCase();
}

export function resolveSidebarIcon(
  input: ResolveSidebarIconInput,
): SidebarIconName {
  const text = textForMatch(input);

  if (
    text.includes("dashboard") ||
    text.includes("overview") ||
    text.includes("/settings")
  ) {
    return "dashboard";
  }

  if (text.includes("calendar")) return "calendar";
  if (text.includes("email") || text.includes("mail")) return "mail";
  if (text.includes("chart") || text.includes("analytics")) return "chart";
  if (text.includes("table")) return "table";
  if (text.includes("layout")) return "layout";
  if (
    text.includes("user") ||
    text.includes("customer") ||
    text.includes("profile")
  ) {
    return "users";
  }
  if (text.includes("role") || text.includes("staff") || text.includes("team")) {
    return "users";
  }
  if (
    text.includes("permission") ||
    text.includes("access") ||
    text.includes("security")
  ) {
    return "shield";
  }
  if (text.includes("setting") || text.includes("config")) return "settings";
  if (text.includes("integration") || text.includes("eld")) return "cube";
  if (text.includes("payment") || text.includes("billing")) return "receipt";
  if (
    text.includes("document") ||
    text.includes("invoice") ||
    text.includes("file")
  ) {
    return "document";
  }
  if (text.includes("ifta") || text.includes("2290") || text.includes("tax")) {
    return "receipt";
  }
  if (text.includes("ucr") || text.includes("filing")) return "stack";
  if (
    text.includes("dmv") ||
    text.includes("renewal") ||
    text.includes("compliance")
  ) {
    return "clipboard";
  }
  if (text.includes("sandbox") || text.includes("tool")) return "cube";

  return "folder";
}

export function SidebarNavIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: SidebarIconName }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === "dashboard" ? (
        <>
          <rect x="3" y="3" width="5" height="5" rx="1.2" />
          <rect x="12" y="3" width="5" height="5" rx="1.2" />
          <rect x="3" y="12" width="5" height="5" rx="1.2" />
          <rect x="12" y="12" width="5" height="5" rx="1.2" />
        </>
      ) : null}

      {name === "calendar" ? (
        <>
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M6.5 2.8v3.4" />
          <path d="M13.5 2.8v3.4" />
          <path d="M3 8.2h14" />
        </>
      ) : null}

      {name === "mail" ? (
        <>
          <rect x="3" y="5" width="14" height="10" rx="2" />
          <path d="m4.5 6.5 5.5 4 5.5-4" />
        </>
      ) : null}

      {name === "document" ? (
        <>
          <path d="M6 3.5h5l3 3v10a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 16.5V5A1.5 1.5 0 0 1 6.5 3.5Z" />
          <path d="M11 3.5V7h3.5" />
          <path d="M7.5 10h5" />
          <path d="M7.5 12.8h5" />
        </>
      ) : null}

      {name === "users" ? (
        <>
          <path d="M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M13.5 10.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          <path d="M3.6 15.6a4.4 4.4 0 0 1 6.8 0" />
          <path d="M11.4 15.4a3.5 3.5 0 0 1 5 0" />
        </>
      ) : null}

      {name === "shield" ? (
        <>
          <path d="M10 3.2 15.5 5v4.4c0 3.4-2.3 6.2-5.5 7.4-3.2-1.2-5.5-4-5.5-7.4V5L10 3.2Z" />
          <path d="m7.8 10.1 1.5 1.5 3-3.3" />
        </>
      ) : null}

      {name === "settings" ? (
        <>
          <path d="M10 6.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
          <path d="M10 2.8v1.5" />
          <path d="M10 15.7v1.5" />
          <path d="m4.2 5.1 1.1 1.1" />
          <path d="m14.7 15.6 1.1 1.1" />
          <path d="M2.8 10h1.5" />
          <path d="M15.7 10h1.5" />
          <path d="m4.2 14.9 1.1-1.1" />
          <path d="m14.7 4.4 1.1-1.1" />
        </>
      ) : null}

      {name === "receipt" ? (
        <>
          <path d="M6 3.5h8a1 1 0 0 1 1 1v11.8l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V4.5a1 1 0 0 1 1-1Z" />
          <path d="M7.2 7.4h5.6" />
          <path d="M7.2 10.1h5.6" />
          <path d="M7.2 12.8H10" />
        </>
      ) : null}

      {name === "stack" ? (
        <>
          <path d="m10 3 6 3.2-6 3.2-6-3.2L10 3Z" />
          <path d="m4 9.4 6 3.2 6-3.2" />
          <path d="m4 12.8 6 3.2 6-3.2" />
        </>
      ) : null}

      {name === "clipboard" ? (
        <>
          <path d="M7.2 4.2h5.6" />
          <path d="M7.6 3h4.8a1.1 1.1 0 0 1 1.1 1.1v.4H15a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 15 17.5H5A1.5 1.5 0 0 1 3.5 16V6A1.5 1.5 0 0 1 5 4.5h1.5v-.4A1.1 1.1 0 0 1 7.6 3Z" />
          <path d="M7 9h6" />
          <path d="M7 12h4.2" />
        </>
      ) : null}

      {name === "cube" ? (
        <>
          <path d="m10 3 6 3.5v7L10 17l-6-3.5v-7L10 3Z" />
          <path d="m4 6.5 6 3.5 6-3.5" />
          <path d="M10 10v7" />
        </>
      ) : null}

      {name === "chart" ? (
        <>
          <path d="M4 16V8" />
          <path d="M10 16V4" />
          <path d="M16 16v-6" />
        </>
      ) : null}

      {name === "table" ? (
        <>
          <rect x="3" y="4" width="14" height="12" rx="1.5" />
          <path d="M3 8h14" />
          <path d="M8 4v12" />
          <path d="M13 4v12" />
        </>
      ) : null}

      {name === "layout" ? (
        <>
          <rect x="3" y="4" width="14" height="12" rx="1.5" />
          <path d="M8 4v12" />
          <path d="M8 8h9" />
        </>
      ) : null}

      {name === "folder" ? (
        <>
          <path d="M3.5 6.2A1.7 1.7 0 0 1 5.2 4.5h3l1.3 1.5h5.3a1.7 1.7 0 0 1 1.7 1.7v6.1a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V6.2Z" />
        </>
      ) : null}
    </svg>
  );
}
