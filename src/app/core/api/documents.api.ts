import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  DocumentType,
  DocumentVerificationDto,
  GeneratedDocumentDto,
} from './documents.types';

/**
 * Interim client for `Documents` module endpoints (SWEB-19/28), verified against
 * `UMS.Modules.Documents.Api.Endpoints.{GenerationEndpoints,VerificationEndpoints}`:
 * - `GET /api/v1/documents/?ownerId={guid}&type={DocumentType}` -- a genuine list endpoint
 *   (ownership/permission-scoped), used for both the Transcript and Receipt viewers.
 * - `GET /api/v1/documents/{id}` -- single document, `downloadUrl` populated once `Ready`.
 * - `GET /api/v1/documents/verify/{verificationId}` -- anonymous, rate-limited (`AllowAnonymous`),
 *   what a printed document's QR code should point to.
 *
 * **Confirmed gap**: transcript generation itself is never dispatched by this client directly --
 * `POST /generate` is permission-gated (`document.document.generate`) and, for a Transcript
 * specifically, is only ever triggered server-side by `Student`'s `StudentRequestService` at
 * `StudentRequest.Approve` time (see `student.api.ts` `submitStudentRequest`'s own doc). This
 * client only ever reads an already (or not-yet) generated `GeneratedDocument`, it never requests
 * one.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsApi extends ProvisionalModuleApiBase {
  listMyDocuments(ownerId: string, type?: DocumentType): Observable<GeneratedDocumentDto[]> {
    let params = new HttpParams().set('ownerId', ownerId);
    if (type) {
      params = params.set('type', type);
    }
    return this.normalizeErrors(
      this.http.get<GeneratedDocumentDto[]>(this.apiUrl('documents'), { params }),
    );
  }

  getDocument(id: string): Observable<GeneratedDocumentDto> {
    return this.normalizeErrors(
      this.http.get<GeneratedDocumentDto>(this.apiUrl(`documents/${id}`)),
    );
  }

  verifyDocument(verificationId: string): Observable<DocumentVerificationDto> {
    return this.normalizeErrors(
      this.http.get<DocumentVerificationDto>(this.apiUrl(`documents/verify/${verificationId}`)),
    );
  }
}
