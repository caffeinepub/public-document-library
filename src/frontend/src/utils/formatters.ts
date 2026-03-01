export function formatFileSize(bytes: bigint | number): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n === 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / BigInt(1_000_000));
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

export function formatDateLong(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / BigInt(1_000_000));
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-powerpoint": "PPT",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PPTX",
    "text/plain": "TXT",
    "text/csv": "CSV",
    "image/jpeg": "JPG",
    "image/jpg": "JPG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/webp": "WEBP",
    "image/svg+xml": "SVG",
    "application/zip": "ZIP",
    "application/x-zip-compressed": "ZIP",
    "application/json": "JSON",
    "application/xml": "XML",
    "text/xml": "XML",
    "video/mp4": "MP4",
    "audio/mpeg": "MP3",
  };
  return map[mimeType] || mimeType.split("/").pop()?.toUpperCase() || "FILE";
}

export function getFileTypeColor(mimeType: string): string {
  if (mimeType.includes("pdf")) return "bg-red-100 text-red-700 border-red-200";
  if (mimeType.includes("word") || mimeType.includes("doc"))
    return "bg-blue-100 text-blue-700 border-blue-200";
  if (
    mimeType.includes("excel") ||
    mimeType.includes("sheet") ||
    mimeType.includes("csv")
  )
    return "bg-green-100 text-green-700 border-green-200";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
    return "bg-orange-100 text-orange-700 border-orange-200";
  if (mimeType.includes("image"))
    return "bg-purple-100 text-purple-700 border-purple-200";
  if (mimeType.includes("video"))
    return "bg-pink-100 text-pink-700 border-pink-200";
  if (mimeType.includes("audio"))
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (mimeType.includes("zip") || mimeType.includes("compressed"))
    return "bg-stone-100 text-stone-700 border-stone-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("doc")) return "📝";
  if (
    mimeType.includes("excel") ||
    mimeType.includes("sheet") ||
    mimeType.includes("csv")
  )
    return "📊";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
    return "📊";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("video")) return "🎬";
  if (mimeType.includes("audio")) return "🎵";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "🗜️";
  if (mimeType.includes("text")) return "📃";
  return "📁";
}
