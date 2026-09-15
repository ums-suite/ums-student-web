import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { InvoiceDto } from './finance.types';

/**
 * Interim client for `Finance` module endpoints (SWEB-5), read-only surface only (this pass never
 * initiates a payment -- SWEB-21/SWEB-22). Verified against
 * `UMS.Modules.Finance.Api.Endpoints.InvoiceEndpoints`:
 * - `GET /api/v1/finance/invoices?ownerId={guid}` -- hard server-side ownership check, a student
 *   can only ever list their own invoices (`RequireLiveSession()`, bare `403` on mismatch).
 */
@Injectable({ providedIn: 'root' })
export class FinanceApi extends ProvisionalModuleApiBase {
  listMyInvoices(ownerId: string): Observable<InvoiceDto[]> {
    const params = new HttpParams().set('ownerId', ownerId);
    return this.normalizeErrors(
      this.http.get<InvoiceDto[]>(this.apiUrl('finance/invoices'), { params }),
    );
  }
}
