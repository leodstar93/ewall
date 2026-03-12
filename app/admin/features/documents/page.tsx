import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthz } from "@/lib/rbac";

type DocumentRow = {
  id: string;
  name: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type UserDocumentsGroup = {
  user: DocumentRow["user"];
  documents: DocumentRow[];
  totalBytes: number;
};

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const precision = unit === 0 ? 0 : 2;
  return `${value.toFixed(precision)} ${units[unit]}`;
}

function formatDate(value: Date) {
  return value.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userLabel(user: DocumentRow["user"]) {
  return user.name?.trim() || user.email?.trim() || `User ${user.id.slice(0, 8)}`;
}

function userSubLabel(user: DocumentRow["user"]) {
  if (user.name && user.email) return user.email;
  if (user.email) return user.email;
  return `ID: ${user.id}`;
}

export default async function AdminDocumentsPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  const backHref = isAdmin ? "/admin" : "/panel";
  const backLabel = isAdmin ? "Back to admin" : "Back to panel";

  const documents = (await prisma.document.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })) as DocumentRow[];

  const groupedMap = new Map<string, UserDocumentsGroup>();

  for (const doc of documents) {
    const current = groupedMap.get(doc.user.id);
    if (!current) {
      groupedMap.set(doc.user.id, {
        user: doc.user,
        documents: [doc],
        totalBytes: doc.fileSize || 0,
      });
      continue;
    }

    current.documents.push(doc);
    current.totalBytes += doc.fileSize || 0;
  }

  const grouped = Array.from(groupedMap.values()).sort((a, b) => {
    if (b.documents.length !== a.documents.length) {
      return b.documents.length - a.documents.length;
    }
    return userLabel(a.user).localeCompare(userLabel(b.user));
  });

  const totalBytes = documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-sm font-semibold">D</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    User documents
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Review uploaded files grouped by each user.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              {backLabel}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total documents
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {documents.length}
              </p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Users with uploads
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {grouped.length}
              </p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Storage used
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {formatFileSize(totalBytes)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        {grouped.length === 0 ? (
          <section className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">No documents yet</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Uploaded files will appear here once users start using the documents module.
            </p>
          </section>
        ) : (
          grouped.map((group) => (
            <section key={group.user.id} className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">
                    {userLabel(group.user)}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">{userSubLabel(group.user)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {group.documents.length} files
                  </span>
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {formatFileSize(group.totalBytes)}
                  </span>
                  {isAdmin && (
                    <Link
                      href={`/admin/users/${group.user.id}`}
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Open user
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Document
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          File
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Size
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Uploaded
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-zinc-900">{doc.name}</p>
                            <p className="mt-1 text-sm text-zinc-600">{doc.description || "-"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-zinc-700">{doc.fileName}</span>
                              <span className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                                {doc.fileType || "file"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-700">
                            {formatFileSize(doc.fileSize)}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-700">
                            {formatDate(doc.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <a
                                href={`/api/v1/features/documents/${doc.id}/view`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                              >
                                View
                              </a>
                              <a
                                href={`/api/v1/features/documents/${doc.id}/download`}
                                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                              >
                                Download
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
