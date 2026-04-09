"use client";

import { useEffect, useMemo, useState } from "react";
import AdvertisingSlider from "./components/advertising/AdvertisingSlider";
import TrucksDropdown, { type DashboardTruckRow } from "./components/trucks/TrucksDropdown";
import CompanyInfoPanel from "./components/ui/CompanyInfo";
import DataTable from "./components/ui/DataTable";
import styles from "./page.module.css";
import type { CompanyInfo, Item, ItemStatus } from "@/lib/types";
import type { TruckRecord } from "@/features/trucks/shared";
import type { UcrFiling } from "@/features/ucr/shared";
import { workflowStageForFiling } from "@/features/ucr/shared";
import type { FilingListItem } from "@/features/ifta-v2/shared";

type DocumentItem = {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
};

type Props = {
  companyInfo: CompanyInfo;
};

type OverviewActivity = {
  name: string;
  category: string;
  status: ItemStatus;
  date: string;
  amount: number;
  sortDate: number;
};

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Request failed for ${url}`);
  }

  return payload;
}

function toItemStatusFromUcr(filing: UcrFiling): ItemStatus {
  const workflow = workflowStageForFiling(filing);

  if (workflow === "COMPLETED") return "Completado";
  if (workflow === "NEEDS_ATTENTION" || workflow === "CANCELLED") return "Inactivo";
  if (workflow === "CREATE_AND_SUBMIT" || workflow === "REQUEST_PAY_CLIENT") return "Pendiente";
  return "Activo";
}

function toItemStatusFromIfta(status: string): ItemStatus {
  if (status === "APPROVED") return "Completado";
  if (["CHANGES_REQUESTED", "REOPENED", "DRAFT", "NEEDS_REVIEW"].includes(status)) {
    return "Pendiente";
  }
  if (["REJECTED", "CANCELLED", "FAILED"].includes(status)) return "Inactivo";
  return "Activo";
}

function toTruckStatus(truck: TruckRecord): DashboardTruckRow["status"] {
  if ((truck._count?.trips ?? 0) > 0) return "En transito";
  if ((truck._count?.fuelPurchases ?? 0) > 0 || (truck._count?.iftaReports ?? 0) > 0) {
    return "Activo";
  }
  if (!truck.is2290Eligible && typeof truck.grossWeight === "number") return "Mantenimiento";
  return "Inactivo";
}

function getTruckUsage(truck: TruckRecord) {
  const parts = [
    truck._count?.trips ? `${truck._count.trips} trip(s)` : null,
    truck._count?.fuelPurchases ? `${truck._count.fuelPurchases} fuel purchase(s)` : null,
    truck._count?.iftaReports ? `${truck._count.iftaReports} IFTA report(s)` : null,
    truck._count?.form2290Filings ? `${truck._count.form2290Filings} 2290 filing(s)` : null,
  ].filter(Boolean);

  return parts.join(" | ") || "No activity yet";
}

export default function DashboardOverviewClient({ companyInfo }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [ucrFilings, setUcrFilings] = useState<UcrFiling[]>([]);
  const [iftaFilings, setIftaFilings] = useState<FilingListItem[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [trucksResult, documentsResult, ucrResult, iftaResult] = await Promise.allSettled([
          fetchJson<{ trucks: TruckRecord[] }>("/api/v1/features/ifta/trucks"),
          fetchJson<{ documents: DocumentItem[] }>("/api/v1/features/documents"),
          fetchJson<{ filings: UcrFiling[] }>("/api/v1/features/ucr"),
          fetchJson<{ filings: FilingListItem[] }>("/api/v1/features/ifta-v2/filings"),
        ]);

        if (!active) return;

        const errors: string[] = [];

        if (trucksResult.status === "fulfilled") {
          setTrucks(Array.isArray(trucksResult.value.trucks) ? trucksResult.value.trucks : []);
        } else {
          errors.push("Could not load trucks.");
          setTrucks([]);
        }

        if (documentsResult.status === "fulfilled") {
          setDocuments(
            Array.isArray(documentsResult.value.documents) ? documentsResult.value.documents : [],
          );
        } else {
          errors.push("Could not load documents.");
          setDocuments([]);
        }

        if (ucrResult.status === "fulfilled") {
          setUcrFilings(Array.isArray(ucrResult.value.filings) ? ucrResult.value.filings : []);
        } else {
          errors.push("Could not load UCR filings.");
          setUcrFilings([]);
        }

        if (iftaResult.status === "fulfilled") {
          setIftaFilings(Array.isArray(iftaResult.value.filings) ? iftaResult.value.filings : []);
        } else {
          errors.push("Could not load IFTA filings.");
          setIftaFilings([]);
        }

        if (errors.length > 0) {
          setError(errors.join(" "));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const slides = useMemo(() => {
    const openIfta = iftaFilings.filter((filing) => filing.status !== "APPROVED").length;
    const pendingUcr = ucrFilings.filter((filing) => workflowStageForFiling(filing) !== "COMPLETED")
      .length;

    return [
      {
        eyebrow: "IFTA",
        title: openIfta > 0 ? `${openIfta} active IFTA filing(s)` : "Your IFTA queue is clear",
        description:
          openIfta > 0
            ? "Open a filing to review miles, gallons, and any exceptions waiting on your side."
            : "Create the next quarter when you are ready or review approved reports.",
        cta: "Open IFTA",
        href: "/v2/dashboard/ifta-v2",
        gradient: "linear-gradient(135deg, #002868 0%, #1a3f8f 100%)",
      },
      {
        eyebrow: "UCR",
        title: pendingUcr > 0 ? `${pendingUcr} UCR filing(s) in progress` : "UCR filings up to date",
        description:
          pendingUcr > 0
            ? "Track payment, review requests, and staff processing from one place."
            : "Start the next annual filing as soon as your registration window opens.",
        cta: "Open UCR",
        href: "/v2/dashboard/ucr",
        gradient: "linear-gradient(135deg, #b22234 0%, #d94a5a 100%)",
      },
      {
        eyebrow: "Documents",
        title: `${documents.length} stored document(s)`,
        description:
          documents.length > 0
            ? "Your uploaded paperwork stays available for future filings and support requests."
            : "Add key permits, receipts, and certificates so they are ready when needed.",
        cta: "Browse docs",
        href: "/v2/dashboard/documents",
        gradient: "linear-gradient(135deg, #002868 0%, #b22234 100%)",
      },
    ];
  }, [documents.length, iftaFilings, ucrFilings]);

  const truckRows = useMemo<DashboardTruckRow[]>(
    () =>
      trucks.map((truck) => ({
        id: truck.unitNumber,
        model: [truck.year, truck.make, truck.model].filter(Boolean).join(" ") || "Truck",
        alias: truck.nickname || "No nickname",
        identifier: truck.plateNumber || truck.vin || "No plate or VIN",
        usage: getTruckUsage(truck),
        status: toTruckStatus(truck),
      })),
    [trucks],
  );

  const activityRows = useMemo<Item[]>(() => {
    const combined: OverviewActivity[] = [
      ...ucrFilings.map((filing) => ({
        name: `UCR ${filing.year}`,
        category: "UCR",
        status: toItemStatusFromUcr(filing),
        date: new Date(filing.updatedAt).toLocaleDateString("en-US"),
        amount: Number(filing.totalCharged ?? 0),
        sortDate: new Date(filing.updatedAt).getTime(),
      })),
      ...iftaFilings.map((filing) => ({
        name: `IFTA ${filing.year} Q${filing.quarter}`,
        category: "IFTA",
        status: toItemStatusFromIfta(filing.status),
        date: new Date(filing.updatedAt || filing.lastCalculatedAt || Date.now()).toLocaleDateString(
          "en-US",
        ),
        amount: Number(filing.totalNetTax ?? 0),
        sortDate: new Date(filing.updatedAt || filing.lastCalculatedAt || 0).getTime(),
      })),
    ]
      .sort((left, right) => right.sortDate - left.sortDate)
      .slice(0, 10);

    return combined.map((item, index) => ({
      id: index + 1,
      name: item.name,
      category: item.category,
      status: item.status,
      date: item.date,
      amount: item.amount,
    }));
  }, [iftaFilings, ucrFilings]);

  return (
    <div className={styles.content}>
      {error ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className={styles.topPanels}>
        <CompanyInfoPanel data={companyInfo} editHref="/settings?tab=company" />
        <AdvertisingSlider slides={slides} />
      </div>

      <TrucksDropdown trucks={truckRows} footerHref="/settings?tab=trucks" />

      <DataTable
        data={
          loading
            ? []
            : activityRows
        }
        searchQuery=""
      />
    </div>
  );
}
