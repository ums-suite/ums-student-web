import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  InitiatePaymentRequest,
  InitiatePaymentResult,
  InvoiceDto,
  PaymentDto,
} from './finance.types';

/**
 * Interim client for `Finance` module endpoints (SWEB-5, extended SWEB-20/21/22). Verified against
 * `UMS.Modules.Finance.Api.Endpoints.{InvoiceEndpoints,PaymentEndpoints}`:
 * - `GET /api/v1/finance/invoices?ownerId={guid}` -- hard server-side ownership check, a student
 *   can only ever list their own invoices (`RequireLiveSession()`, bare `403` on mismatch).
 * - `GET /api/v1/finance/invoices/{id}` -- single invoice, same ownership check.
 * - `POST /api/v1/finance/payments` (SWEB-21) -- the idempotency key is a **request header**
 *   literally named `Idempotency-Key` (confirmed server-side, not a body field -- contrast
 *   Hostel's `SubmitComplaintRequest.IdempotencyKey`, a body field; the two modules are NOT
 *   consistent with each other, verified by direct source inspection of both).
 * - `GET /api/v1/finance/payments/{id}` (SWEB-22 post-redirect status poll).
 *
 * **Confirmed gaps**: no "list my payments" endpoint exists (only get-by-id) -- a payment must be
 * tracked by the id this app itself received from `initiatePayment`. No itemized
 * invoice-line-item endpoint (see `finance.types.ts` `InvoiceDto` doc). No "get payment by
 * idempotency key" endpoint -- the key is consulted only inside `POST /payments` itself to decide
 * replay-vs-new.
 */
@Injectable({ providedIn: 'root' })
export class FinanceApi extends ProvisionalModuleApiBase {
  listMyInvoices(ownerId: string): Observable<InvoiceDto[]> {
    const params = new HttpParams().set('ownerId', ownerId);
    return this.normalizeErrors(
      this.http.get<InvoiceDto[]>(this.apiUrl('finance/invoices'), { params }),
    );
  }

  getInvoice(id: string): Observable<InvoiceDto> {
    return this.normalizeErrors(this.http.get<InvoiceDto>(this.apiUrl(`finance/invoices/${id}`)));
  }

  /**
   * SWEB-21: `idempotencyKey` is sent as the `Idempotency-Key` header, never in the body -- a
   * fresh network retry of the exact same submission (same key) collapses server-side to the
   * same `Payment` row rather than double-charging (design-decisions.md "Payment
   * Idempotency-Key Persistence").
   */
  initiatePayment(
    request: InitiatePaymentRequest,
    idempotencyKey: string,
  ): Observable<InitiatePaymentResult> {
    return this.normalizeErrors(
      this.http.post<InitiatePaymentResult>(this.apiUrl('finance/payments'), request, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
  }

  /** SWEB-22: post-redirect status poll target -- `PaymentDto.status` is the sole authority (Invariant §8.3, Domain Invariant #3). */
  getPayment(id: string): Observable<PaymentDto> {
    return this.normalizeErrors(this.http.get<PaymentDto>(this.apiUrl(`finance/payments/${id}`)));
  }
}
