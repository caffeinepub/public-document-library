import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalBlob } from "../backend";
import { useActor } from "./useActor";

export interface BackendPhoto {
  id: string;
  title: string;
  blob: ExternalBlob;
  resolution: { height: bigint; width: bigint };
  timestamp: bigint;
}

export function useListPhotos() {
  const { actor, isFetching } = useActor();
  return useQuery<BackendPhoto[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPhotos() as Promise<BackendPhoto[]>;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSavePhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      file,
      width,
      height,
    }: {
      title: string;
      file: File;
      width: number;
      height: number;
    }) => {
      if (!actor) throw new Error("Backend not ready");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes);
      return actor.savePhoto(
        title,
        { width: BigInt(width), height: BigInt(height) },
        blob,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

export function useDeleteBackendPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.deletePhoto(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}
