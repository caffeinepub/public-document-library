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
export interface Document {
    id: string;
    title: string;
    uploaderName: string;
    description: string;
    fileSize: bigint;
    fileType: string;
    blobId: ExternalBlob;
    uploadedAt: Time;
}
export type Time = bigint;
export interface backendInterface {
    deleteDocument(id: string): Promise<void>;
    getAllDocuments(): Promise<Array<Document>>;
    getDocumentById(id: string): Promise<Document>;
    searchDocuments(searchTerm: string): Promise<Array<Document>>;
    uploadDocument(title: string, description: string, uploaderName: string, blob: ExternalBlob, fileType: string, fileSize: bigint): Promise<string>;
}
