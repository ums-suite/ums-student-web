/**
 * `Finance` module DTOs (SWEB-5), verified against
 * `UMS.Modules.Finance.Application/Invoices/InvoiceDto.cs` and
 * `UMS.Modules.Finance.Api/Endpoints/InvoiceEndpoints.cs`.
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
