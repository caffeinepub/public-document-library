import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useUploadDocument } from "../hooks/useQueries";
import {
  formatFileSize,
  getFileIcon,
  getFileTypeLabel,
} from "../utils/formatters";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadDocument();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setUploaderName("");
    setFile(null);
    setProgress(0);
    setErrors({});
  };

  const handleClose = () => {
    if (!uploadMutation.isPending) {
      resetForm();
      onClose();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!file) newErrors.file = "Please select a file";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await uploadMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        uploaderName: uploaderName.trim() || "Anonymous",
        file: file!,
        onProgress: setProgress,
      });
      toast.success("Document uploaded successfully!");
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error("Upload failed. Please try again.");
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Upload Document
          </DialogTitle>
          <DialogDescription>
            Add a document to the public library. Anyone can view and download
            it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
              }}
              placeholder="e.g. Government ID Proof, Land Records..."
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Uploader Name */}
          <div className="space-y-1.5">
            <Label htmlFor="uploaderName" className="text-sm font-medium">
              Your Name
            </Label>
            <Input
              id="uploaderName"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              placeholder="Leave blank for Anonymous"
            />
          </div>

          {/* File picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              File <span className="text-destructive">*</span>
            </Label>

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`relative rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                    ${
                      isDragging
                        ? "border-accent bg-accent/10 upload-zone-active"
                        : "border-border hover:border-primary/40 upload-zone"
                    }
                    ${errors.file ? "border-destructive" : ""}
                  `}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFile(f);
                        if (errors.file)
                          setErrors((prev) => ({ ...prev, file: "" }));
                      }
                    }}
                    accept="*/*"
                  />
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    {isDragging ? "Drop file here" : "Click or drag & drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All file types supported — PDF, Word, Excel, images, and
                    more
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="selected"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border"
                >
                  <div className="text-2xl">{getFileIcon(file.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getFileTypeLabel(file.type)} ·{" "}
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  {!uploadMutation.isPending && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {errors.file && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.file}
              </p>
            )}
          </div>

          {/* Upload progress */}
          {uploadMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading...
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>
          )}

          {/* Success hint */}
          {uploadMutation.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Document uploaded successfully!
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploadMutation.isPending}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
