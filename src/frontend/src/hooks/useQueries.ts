import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Document, ExternalBlob } from "../backend";
import { useActor } from "./useActor";

export function useGetAllDocuments() {
  const { actor, isFetching } = useActor();
  return useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllDocuments();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetDocumentById(id: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Document>({
    queryKey: ["document", id],
    queryFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.getDocumentById(id);
    },
    enabled: !!actor && !isFetching && !!id,
  });
}

export function useSearchDocuments(searchTerm: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Document[]>({
    queryKey: ["documents", "search", searchTerm],
    queryFn: async () => {
      if (!actor) return [];
      if (!searchTerm.trim()) return actor.getAllDocuments();
      return actor.searchDocuments(searchTerm);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUploadDocument() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      uploaderName,
      file,
      onProgress,
    }: {
      title: string;
      description: string;
      uploaderName: string;
      file: File;
      onProgress?: (pct: number) => void;
    }) => {
      if (!actor) throw new Error("Backend not ready");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let blob = ExternalBlob.fromBytes(bytes);
      if (onProgress) {
        blob = blob.withUploadProgress(onProgress);
      }
      return actor.uploadDocument(
        title,
        description,
        uploaderName,
        blob,
        file.type || "application/octet-stream",
        BigInt(file.size),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocument() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.deleteDocument(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
