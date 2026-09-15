/**
 * `Hostel` module DTOs (SWEB-5), verified against
 * `UMS.Modules.Hostel.Application/Allocations/AllocationDto.cs` and
 * `UMS.Modules.Hostel.Api/Endpoints/AllocationEndpoints.cs`.
 */
export type AllocationStatus = 'Pending' | 'FeePaid' | 'Active' | 'CheckedOut' | 'Expired';

export interface AllocationDto {
  readonly id: string;
  readonly studentId: string;
  readonly bedId: string;
  readonly roomId: string;
  readonly hostelId: string;
  readonly hostelApplicationId: string;
  readonly status: AllocationStatus;
  readonly invoiceId: string | null;
  readonly feeGraceDeadline: string;
  readonly checkOutKind: string | null;
  readonly refundRequested: boolean;
  readonly createdAt: string;
  readonly feePaidAt: string | null;
  readonly activatedAt: string | null;
  readonly checkedOutAt: string | null;
  readonly expiredAt: string | null;
}
