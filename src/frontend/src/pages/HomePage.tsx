import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Library,
  Search,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DocumentCard, DocumentCardSkeleton } from "../components/DocumentCard";
import { UploadModal } from "../components/UploadModal";
import { useMetaTags } from "../hooks/useMetaTags";
import { useSearchDocuments } from "../hooks/useQueries";

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useMetaTags({
    title: "Public Document Library — Sharable Documents for Everyone",
    description:
      "A free public document repository. Upload and share government documents, educational resources, reports, and more. Accessible to everyone.",
    ogImage: "/assets/generated/hero-document-library.dim_1600x500.jpg",
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: documents,
    isLoading,
    isError,
  } = useSearchDocuments(debouncedQuery);

  const docCount = documents?.length ?? 0;

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* ── Header ── */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <a
              href="/"
              className="flex items-center gap-2.5 flex-shrink-0 group"
            >
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center group-hover:bg-primary/80 transition-colors">
                <Library className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg text-foreground hidden sm:block">
                DocLibrary
              </span>
            </a>

            <Button
              onClick={() => setUploadOpen(true)}
              size="sm"
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </Button>
          </div>
        </header>

        <main className="flex-1">
          {/* ── Hero Section ── */}
          <section className="relative overflow-hidden bg-card border-b border-border">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10"
              style={{
                backgroundImage:
                  "url('/assets/generated/hero-document-library.dim_1600x500.jpg')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/20 to-background/60" />

            <div className="relative container mx-auto px-4 py-14 md:py-20 text-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent-foreground bg-accent/20 border border-accent/30 rounded-full px-3 py-1 mb-5">
                  <BookOpen className="w-3 h-3" />
                  Public Document Repository
                </div>

                <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight text-balance mb-4">
                  Share Documents{" "}
                  <span className="text-accent-foreground relative">
                    with the World
                  </span>
                </h1>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8 text-balance">
                  Upload your documents — government records, certificates,
                  reports, or anything else — and make them publicly accessible
                  for everyone to find and download.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Button
                    onClick={() => setUploadOpen(true)}
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Document
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => searchRef.current?.focus()}
                    className="gap-2 px-6"
                  >
                    <Search className="w-4 h-4" />
                    Browse Library
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ── Search + Documents ── */}
          <section className="container mx-auto px-4 py-8 md:py-10">
            {/* Search bar */}
            <div className="mb-8">
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents by title or description..."
                  className="pl-10 pr-10 h-11 text-base"
                  aria-label="Search documents"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Results header */}
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  <span>Loading documents...</span>
                ) : searchQuery ? (
                  <span>
                    <strong className="text-foreground">{docCount}</strong>{" "}
                    result{docCount !== 1 ? "s" : ""} for{" "}
                    <strong className="text-foreground">"{searchQuery}"</strong>
                  </span>
                ) : (
                  <span>
                    <strong className="text-foreground">{docCount}</strong>{" "}
                    document{docCount !== 1 ? "s" : ""} in the library
                  </span>
                )}
              </div>
            </div>

            {/* Loading skeletons */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((k) => (
                  <DocumentCardSkeleton key={k} />
                ))}
              </div>
            )}

            {/* Error state */}
            {isError && !isLoading && (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="font-display text-lg font-semibold mb-2">
                  Could not load documents
                </h3>
                <p className="text-muted-foreground text-sm">
                  Please check your connection and try again.
                </p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && documents?.length === 0 && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16 border-2 border-dashed border-border rounded-xl"
                >
                  {searchQuery ? (
                    <>
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                      <h3 className="font-display text-lg font-semibold mb-2">
                        No results found
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Try different keywords or browse all documents
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <>
                      <Library className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                      <h3 className="font-display text-lg font-semibold mb-2">
                        Library is empty
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Be the first to upload a document!
                      </p>
                      <Button
                        onClick={() => setUploadOpen(true)}
                        size="sm"
                        className="bg-primary text-primary-foreground"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload First Document
                      </Button>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Document grid */}
            {!isLoading && !isError && documents && documents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc, i) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    index={i}
                    onClick={() => {
                      window.location.href = `/document/${doc.id}`;
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-border bg-card mt-auto">
          <div className="container mx-auto px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()}. Built with ❤️ using{" "}
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

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
