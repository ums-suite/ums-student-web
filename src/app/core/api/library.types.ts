/**
 * `Library` module DTOs (SWEB-26/27), verified against `UMS.Modules.Library.Application/*` and
 * `UMS.Modules.Library.Api/Endpoints/{BookEndpoints,LoanEndpoints,ReservationEndpoints,FineEndpoints}.cs`.
 */
export interface BookDto {
  readonly id: string;
  readonly title: string;
  readonly isbn: string | null;
  readonly categoryId: string | null;
  readonly authorIds: readonly string[];
  readonly edition: string | null;
  readonly isOpenAccessDigital: boolean;
  readonly withdrawn: boolean;
  readonly createdAt: string;
}

/**
 * `GET /api/v1/library/books/?q=&categoryId=&authorId=&page=&pageSize=` -- **not** a raw
 * `BookDto[]`. Confirmed against `BookSearchService.SearchAsync`/`BookSearchResultDto`: search
 * results already carry resolved category/author *names* and live copy-availability counts, so
 * the catalog browser (SWEB-26) never needs a second round-trip per result card just to show
 * "3 of 5 copies available".
 */
export interface BookSearchResultDto {
  readonly id: string;
  readonly title: string;
  readonly isbn: string | null;
  readonly categoryName: string | null;
  readonly authorNames: readonly string[];
  readonly availableCopyCount: number;
  readonly totalCopyCount: number;
  readonly withdrawn: boolean;
}

export interface BookSearchPageDto {
  readonly items: readonly BookSearchResultDto[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

/** `Status` values per the domain's `BookCopyStatus`: a copy is only loan-eligible when `Available`, or `Reserved` for the specific borrower it was offered to. */
export type BookCopyStatus = 'Available' | 'Reserved' | 'OnLoan' | 'Lost' | 'Withdrawn';

export interface BookCopyDto {
  readonly id: string;
  readonly bookId: string;
  readonly accessionNumber: string;
  readonly condition: string;
  readonly copyType: string;
  readonly status: BookCopyStatus;
  readonly createdAt: string;
}

export type BorrowerType = 'Student' | 'Faculty' | 'Staff';

/** `IsOverdue` is a computed boolean field, not a `Status` member -- always derive an overdue badge from this, never from `status === 'Overdue'` (no such status exists). */
export type LoanStatus = 'Active' | 'Returned' | 'LostWriteOff';

export interface LoanDto {
  readonly id: string;
  readonly bookCopyId: string;
  readonly bookId: string;
  readonly borrowerId: string;
  readonly borrowerType: BorrowerType;
  readonly issuedByUserId: string | null;
  readonly issuedAt: string;
  readonly dueDate: string;
  readonly renewalCount: number;
  readonly status: LoanStatus;
  readonly isOverdue: boolean;
  readonly returnedAt: string | null;
  readonly lostWriteOffAt: string | null;
}

export type ReservationStatus = 'Queued' | 'Offered' | 'Claimed' | 'Expired';

/**
 * `POST /api/v1/library/reservations/`. **Confirmed**: creation is rejected outright
 * (`reservation.copy_available`) when a copy is actually available -- "issue a Loan instead of
 * reserving". Also `reservation.already_queued` on a duplicate.
 *
 * **Confirmed gap -- no client-visible race error code.** A losing concurrent claim on an offered
 * copy is silently absorbed server-side (a no-op atomic conditional update, not an error); the
 * "someone reserved this just before you" message (edge-cases.md "Library reservation race",
 * SWEB-27) must therefore be inferred client-side by re-fetching `/reservations/me` after a claim
 * attempt and observing the reservation did NOT move to `Claimed` by this student -- never
 * fabricated as if the server returned a dedicated error.
 */
export interface ReservationDto {
  readonly id: string;
  readonly bookId: string;
  readonly borrowerId: string;
  readonly borrowerType: BorrowerType;
  readonly priority: number;
  readonly status: ReservationStatus;
  readonly offeredCopyId: string | null;
  readonly offeredAt: string | null;
  readonly claimWindowExpiresAt: string | null;
  readonly claimedAt: string | null;
  readonly expiredAt: string | null;
  readonly createdAt: string;
}

export type FineStatus = 'Accruing' | 'PendingSettlement' | 'Paid' | 'Waived';
export type FineReason = 'Overdue' | 'LostReplacement';

/**
 * `POST /fines/{id}/settle` only ever **initiates** settlement (creates a Finance `Invoice`,
 * `Accruing -> PendingSettlement`) -- the final `Paid` transition happens asynchronously once
 * Finance's payment webhook is relayed back, so a client must poll `GET /fines/me` to observe
 * `status` actually flip to `Paid` (SWEB-26, "settled through Finance").
 */
export interface FineDto {
  readonly id: string;
  readonly loanId: string;
  readonly borrowerId: string;
  readonly borrowerType: BorrowerType;
  readonly reason: FineReason;
  readonly amount: number;
  readonly currency: string;
  readonly status: FineStatus;
  readonly invoiceId: string | null;
  readonly createdAt: string;
  readonly settledAt: string | null;
  readonly waivedAt: string | null;
}
