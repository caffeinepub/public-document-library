import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Download,
  Eye,
  FileType,
  HardDrive,
  Library,
  Loader2,
  Trash2,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useMetaTags } from "../hooks/useMetaTags";
import { useDeleteDocument, useGetDocumentById } from "../hooks/useQueries";
import {
  formatDateLong,
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  getFileTypeLabel,
} from "../utils/formatters";

interface DocumentDetailPageProps {
  documentId: string;
}

function DocumentMetaTags({
  doc,
}: { doc: { title: string; description: string } }) {
  useMetaTags({
    title: `${doc.title} — Rana Document`,
    description: doc.description || `Dekho aur download karo: ${doc.title}`,
    ogType: "article",
  });
  return null;
}

function DefaultMetaTags() {
  useMetaTags({
    title: "Document — Rana Document",
    description:
      "Is document ko Rana Document library se dekho aur download karo.",
  });
  return null;
}

export function DocumentDetailPage({ documentId }: DocumentDetailPageProps) {
  const { data: doc, isLoading, isError } = useGetDocumentById(documentId);
  const deleteMutation = useDeleteDocument();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(documentId);
      toast.success("Document deleted.");
      window.location.href = "/";
    } catch {
      toast.error("Failed to delete document.");
    }
  };

  if (isLoading) {
    return (
      <>
        <DefaultMetaTags />
        <PageShell>
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Loading document...</p>
          </div>
        </PageShell>
      </>
    );
  }

  if (isError || !doc) {
    return (
      <>
        <DefaultMetaTags />
        <PageShell>
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/50" />
            <h2 className="font-display text-xl font-semibold">
              Document not found
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              This document may have been deleted or the link may be incorrect.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <a href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Library
              </a>
            </Button>
          </div>
        </PageShell>
      </>
    );
  }

  const fileTypeLabel = getFileTypeLabel(doc.fileType);
  const fileTypeColor = getFileTypeColor(doc.fileType);
  const fileIcon = getFileIcon(doc.fileType);
  const downloadUrl = doc.blobId.getDirectURL();
  const isPreviewable =
    doc.fileType.startsWith("image/") ||
    doc.fileType === "application/pdf" ||
    doc.fileType.startsWith("text/");

  return (
    <>
      <DocumentMetaTags doc={doc} />
      <PageShell>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Back */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
          >
            {/* File type header */}
            <div className={`h-2 w-full ${fileTypeColor.split(" ")[0]}`} />

            <div className="p-6 md:p-8">
              {/* Title section */}
              <div className="flex items-start gap-4 mb-6">
                <div className="text-5xl flex-shrink-0">{fileIcon}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold px-2.5 py-0.5 border mb-2 ${fileTypeColor}`}
                    >
                      {fileTypeLabel}
                    </Badge>
                  </div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground leading-snug">
                    {doc.title}
                  </h1>
                  {doc.description && (
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                      {doc.description}
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-5" />

              {/* Meta grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MetaItem
                  icon={<User className="w-4 h-4" />}
                  label="Uploaded by"
                  value={doc.uploaderName || "Anonymous"}
                />
                <MetaItem
                  icon={<Calendar className="w-4 h-4" />}
                  label="Uploaded on"
                  value={formatDateLong(doc.uploadedAt)}
                />
                <MetaItem
                  icon={<HardDrive className="w-4 h-4" />}
                  label="File size"
                  value={formatFileSize(doc.fileSize)}
                />
                <MetaItem
                  icon={<FileType className="w-4 h-4" />}
                  label="File type"
                  value={doc.fileType}
                />
              </div>

              <Separator className="my-5" />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  <a
                    href={downloadUrl}
                    download={doc.title}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                </Button>

                {isPreviewable && (
                  <Button variant="outline" asChild className="gap-2">
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Eye className="w-4 h-4" />
                      View in Browser
                    </a>
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The document will be
                        permanently removed from the public library.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Delete Document
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Sharing tip */}
              <div className="mt-6 p-4 rounded-lg bg-secondary/60 border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">
                    Share this document:
                  </strong>{" "}
                  Copy the page URL to share this document with anyone. It's
                  publicly accessible and searchable on Google.
                </p>
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="mt-2 w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-muted-foreground cursor-text select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  aria-label="Page URL for sharing"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </PageShell>
    </>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium text-foreground truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center group-hover:bg-primary/80 transition-colors">
              <Library className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground hidden sm:block">
              Rana Document
            </span>
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Rana Document. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
