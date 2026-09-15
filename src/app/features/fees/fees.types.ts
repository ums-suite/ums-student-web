import type { GeneratedDocumentDto } from '../../core/api/documents.types';

/**
 * Fees/payment view shapes (SWEB-20..22). **Confirmed gap**: no "list my payments" endpoint
 * exists (`finance.api.ts` doc) -- payment history is instead sourced from Documents' own
 * `GET /documents/?ownerId=&type=Receipt` list, since a `Receipt` `GeneratedDocument` is created
 * automatically server-side on every successful `Payment` (`ReceiptRequesterAdapter`, confirmed:
 * `SourceReferenceId` on that `GeneratedDocument` is the `PaymentId`). This genuinely reflects
 * every successful payment ever made (not merely same-browser ones, unlike the enrollment/
 * StudentRequest tracking workarounds elsewhere in this app) -- a real advantage of this
 * particular gap's shape. A payment that never succeeded (still pending, or failed) has no
 * receipt and therefore never appears in this list, which is the desired "payment history" scope
 * anyway.
 */
export interface ReceiptEntry {
  readonly paymentId: string;
  readonly document: GeneratedDocumentDto;
}
