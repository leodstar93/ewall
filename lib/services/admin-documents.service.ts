import { prisma } from "@/lib/prisma";

export type AdminDocumentDirectoryItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCompanyName: string;
};

export type AdminDocumentDirectoryData = {
  items: AdminDocumentDirectoryItem[];
  availableCategories: string[];
  availableFileTypes: string[];
};

function displayCompanyName(input: {
  companyName: string | null;
  legalName: string | null;
  dbaName: string | null;
}) {
  return (
    input.companyName?.trim() ||
    input.legalName?.trim() ||
    input.dbaName?.trim() ||
    ""
  );
}

function displayUserName(input: {
  id: string;
  name: string | null;
  email: string | null;
}) {
  return input.name?.trim() || input.email?.trim() || `User ${input.id.slice(0, 8)}`;
}

export async function listAdminDocuments(): Promise<AdminDocumentDirectoryData> {
  const rows = await prisma.document.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      fileName: true,
      fileUrl: true,
      fileSize: true,
      fileType: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          companyProfile: {
            select: {
              companyName: true,
              legalName: true,
              dbaName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const availableCategories = Array.from(
    new Set(
      rows
        .map((row) => row.category?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const availableFileTypes = Array.from(
    new Set(
      rows
        .map((row) => row.fileType?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize,
      fileType: row.fileType,
      createdAt: row.createdAt.toISOString(),
      userId: row.user.id,
      userName: displayUserName(row.user),
      userEmail: row.user.email ?? "",
      userCompanyName: displayCompanyName({
        companyName: row.user.companyProfile?.companyName ?? null,
        legalName: row.user.companyProfile?.legalName ?? null,
        dbaName: row.user.companyProfile?.dbaName ?? null,
      }),
    })),
    availableCategories,
    availableFileTypes,
  };
}
