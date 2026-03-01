import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Eye, HardDrive, User } from "lucide-react";
import { motion } from "motion/react";
import type { Document } from "../backend";
import {
  formatDate,
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  getFileTypeLabel,
} from "../utils/formatters";

interface DocumentCardProps {
  doc: Document;
  onClick: () => void;
  index?: number;
}

export function DocumentCard({ doc, onClick, index = 0 }: DocumentCardProps) {
  const fileTypeLabel = getFileTypeLabel(doc.fileType);
  const fileTypeColor = getFileTypeColor(doc.fileType);
  const fileIcon = getFileIcon(doc.fileType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
    >
      <div
        onClick={onClick}
        className="group cursor-pointer bg-card rounded-lg shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 overflow-hidden border border-border"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        aria-label={`View document: ${doc.title}`}
      >
        {/* Top accent — file type color strip */}
        <div
          className={`h-1.5 w-full ${fileTypeColor.split(" ")[0].replace("bg-", "bg-")} opacity-60`}
        />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="text-3xl flex-shrink-0 mt-0.5 leading-none">
              {fileIcon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-foreground text-base leading-snug line-clamp-2 group-hover:text-primary/80 transition-colors">
                {doc.title}
              </h3>
              {doc.description && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-2 leading-relaxed">
                  {doc.description}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 border ${fileTypeColor}`}
            >
              {fileTypeLabel}
            </Badge>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[100px]">
                {doc.uploaderName || "Anonymous"}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(doc.uploadedAt)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatFileSize(doc.fileSize)}
            </span>
          </div>
        </div>

        {/* Hover footer */}
        <div className="px-5 pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-1.5 text-xs text-primary/70 font-medium">
            <Eye className="w-3.5 h-3.5" />
            <span>Click to view & download</span>
            <Download className="w-3.5 h-3.5 ml-auto" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="bg-card rounded-lg shadow-card overflow-hidden border border-border animate-pulse">
      <div className="h-1.5 w-full bg-muted" />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 bg-muted rounded flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-full mb-1" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
          <div className="w-12 h-5 bg-muted rounded-full flex-shrink-0" />
        </div>
        <div className="mt-3 pt-3 border-t border-border flex gap-3">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-3 bg-muted rounded w-14" />
        </div>
      </div>
    </div>
  );
}
