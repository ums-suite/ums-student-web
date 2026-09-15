/**
 * `Documents` module DTOs (SWEB-19/28), verified against
 * `UMS.Modules.Documents.Domain.GeneratedDocuments.GeneratedDocumentStatus`,
 * `UMS.Modules.Documents.Application.Generation.GeneratedDocumentDto`, and
 * `UMS.Modules.Documents.Api.Endpoints.{GenerationEndpoints,VerificationEndpoints}`.
 *
 * There is **one generic** generation/download surface -- no dedicated `/transcript` or
 * `/receipt` route; every document type (transcript, receipt, ID card, ...) funnels through the
 * same `GET /api/v1/documents/{id}` / `GET /api/v1/documents/?ownerId=&type=` pair, discriminated
 * by {@link DocumentType} alone.
 */
export type DocumentType =
  | 'AdmitCard'
  | 'MeritList'
  | 'Transcript'
  | 'Certificate'
  | 'IdCard'
  | 'Receipt'
  | 'RegulatoryReport';

/**
 * Legal transitions: `Pending -> Uploaded -> Ready -> (Revoked | Superseded)`; `Pending`/
 * `Uploaded -> Failed`. `DownloadUrl` is only ever populated once `status === 'Ready'`.
 */
export type GeneratedDocumentStatus =
  'Pending' | 'Uploaded' | 'Ready' | 'Revoked' | 'Superseded' | 'Failed';

export interface GeneratedDocumentDto {
  readonly id: string;
  readonly ownerId: string;
  readonly documentType: DocumentType;
  readonly sourceReferenceId: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly status: GeneratedDocumentStatus;
  /** The QR/digital-verification id (`ums-requirements.md` §4.1 pt. 6, ADR-0010) -- what a printed transcript/receipt's QR code encodes. */
  readonly digitalVerificationId: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly createdAt: string;
  readonly readyAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly supersededByDocumentId: string | null;
  /** A short-lived (15 min TTL) presigned object-storage URL -- only present once `status === 'Ready'`. Re-`GET` this document if the link has gone stale rather than caching it. */
  readonly downloadUrl: string | null;
}

/** `GET /api/v1/documents/verify/{verificationId}` -- the one deliberately anonymous, rate-limited endpoint. Never exposes the owner or a download reference; metadata-only ("is this real and still valid"). */
export interface DocumentVerificationDto {
  readonly digitalVerificationId: string;
  readonly documentType: DocumentType;
  readonly status: GeneratedDocumentStatus;
  readonly isValid: boolean;
  readonly reason: string | null;
  readonly issuedAt: string;
  readonly readyAt: string | null;
}
