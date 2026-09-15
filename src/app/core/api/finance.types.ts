/**
 * `Finance` module DTOs (SWEB-5, extended SWEB-20/21/22), verified against
 * `UMS.Modules.Finance.Application/Invoices/InvoiceDto.cs`,
 * `UMS.Modules.Finance.Application/Payments/PaymentDto.cs`, and
 * `UMS.Modules.Finance.Api/Endpoints/{InvoiceEndpoints,PaymentEndpoints}.cs`.
 *
 * **Confirmed gap**: `InvoiceDto` carries no line-item/breakdown field at all -- the domain
 * `Invoice` entity has `Items` (`FeeStructureId`, `Description`, `Amount`, `Currency` per line),
 * but `InvoiceService.ToDto()` never projects them into the DTO, so there is no itemized
 * fee-breakdown surface over HTTP today. SWEB-20's "itemized fee breakdown" therefore renders
 * only the one `InvoiceDto` row itself (feeType/totalAmount), never a synthesized/invented line
 * list -- flagged, not silently faked.
 */
export type InvoiceStatus = 'Open' | 'Paid' | 'Voided';

export interface InvoiceDto {
  readonly id: string;
  readonly sourceModule: string;
  readonly sourceReferenceId: string;
  readonly feeType: string;
  readonly ownerId: string;
  readonly totalAmount: number;
  readonly currency: string;
  readonly status: InvoiceStatus;
  readonly createdAt: string;
  readonly paidAt: string | null;
}

/** Real backend enum values (`PaymentStatus`) -- forward-only state machine. */
export type PaymentStatus = 'Initiated' | 'Pending' | 'Successful' | 'Failed' | 'Reconciled';

/**
 * `POST /api/v1/finance/payments`. **Confirmed**: only SSLCommerz is implemented server-side
 * (`SslCommerzPaymentGateway`) -- no bKash/Nagad gateway exists anywhere in `ums-core` despite
 * `ums-requirements.md` §9's illustrative naming. `gatewayName` is always `"SSLCommerz"` today.
 */
export interface InitiatePaymentRequest {
  readonly invoiceId: string;
}

export interface PaymentDto {
  readonly id: string;
  readonly invoiceId: string;
  readonly ownerId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly gatewayName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * What `POST /payments` actually returns -- `redirectUrl` is `null` when the call replayed
 * already-stored state (an idempotent re-submission) instead of freshly hitting the gateway, per
 * `InitiatePaymentResult`'s own real shape (`PaymentDto`, `RedirectUrl: string?`).
 */
export interface InitiatePaymentResult {
  readonly payment: PaymentDto;
  readonly redirectUrl: string | null;
}
