import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export type Time = bigint;
export interface Resolution {
    height: bigint;
    width: bigint;
}
export interface Photo {
    id: string;
    title: string;
    blob: ExternalBlob;
    resolution: Resolution;
    timestamp: Time;
}
export interface backendInterface {
    deletePhoto(id: string): Promise<void>;
    getPhoto(id: string): Promise<Photo>;
    listPhotos(): Promise<Array<Photo>>;
    savePhoto(title: string, resolution: Resolution, blob: ExternalBlob): Promise<string>;
    searchPhotos(searchTerm: string): Promise<Array<Photo>>;
}
