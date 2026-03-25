import DocumentsPage from "@/features/documents/page-component";

export default function SandboxClientDocumentsPage() {
  return (
    <DocumentsPage
      apiBasePath="/api/v1/sandbox/client/documents"
      title="Sandbox Documents"
      subtitle="Upload and manage demo-user documents inside isolated sandbox storage."
    />
  );
}
