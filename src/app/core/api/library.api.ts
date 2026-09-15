import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  BookCopyDto,
  BookDto,
  BookSearchPageDto,
  FineDto,
  LoanDto,
  ReservationDto,
} from './library.types';

/**
 * Interim client for `Library` module endpoints (SWEB-26/27), verified against
 * `UMS.Modules.Library.Api.Endpoints.{BookEndpoints,LoanEndpoints,ReservationEndpoints,FineEndpoints}`:
 * - `GET /api/v1/library/books/?q=&categoryId=&authorId=&page=&pageSize=` -- exactly these four
 *   filter params exist server-side; no `isbn`/`availableOnly` filter (confirmed).
 * - `GET /loans/me`, `GET /reservations/me`, `GET /fines/me` -- all genuine list endpoints (unlike
 *   Student's/Notifications' own confirmed "no list" gaps), resolved via the caller's own borrower
 *   context, no id/query param needed.
 */
@Injectable({ providedIn: 'root' })
export class LibraryApi extends ProvisionalModuleApiBase {
  /** Returns a paged envelope of resolved `BookSearchResultDto` rows, never a raw `BookDto[]` -- see `library.types.ts` `BookSearchPageDto` doc. */
  searchBooks(query: {
    readonly q?: string;
    readonly categoryId?: string;
    readonly authorId?: string;
    readonly page?: number;
    readonly pageSize?: number;
  }): Observable<BookSearchPageDto> {
    let params = new HttpParams();
    if (query.q) params = params.set('q', query.q);
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.authorId) params = params.set('authorId', query.authorId);
    params = params
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));
    return this.normalizeErrors(
      this.http.get<BookSearchPageDto>(this.apiUrl('library/books/'), { params }),
    );
  }

  getBook(id: string): Observable<BookDto> {
    return this.normalizeErrors(this.http.get<BookDto>(this.apiUrl(`library/books/${id}`)));
  }

  listCopies(bookId: string): Observable<BookCopyDto[]> {
    return this.normalizeErrors(
      this.http.get<BookCopyDto[]>(this.apiUrl(`library/books/${bookId}/copies`)),
    );
  }

  getMyLoans(): Observable<LoanDto[]> {
    return this.normalizeErrors(this.http.get<LoanDto[]>(this.apiUrl('library/loans/me')));
  }

  renewLoan(id: string): Observable<LoanDto> {
    return this.normalizeErrors(
      this.http.post<LoanDto>(this.apiUrl(`library/loans/${id}/renew`), {}),
    );
  }

  getMyReservations(): Observable<ReservationDto[]> {
    return this.normalizeErrors(
      this.http.get<ReservationDto[]>(this.apiUrl('library/reservations/me')),
    );
  }

  reserveBook(bookId: string): Observable<ReservationDto> {
    return this.normalizeErrors(
      this.http.post<ReservationDto>(this.apiUrl('library/reservations/'), { bookId }),
    );
  }

  /** SWEB-27: claiming an offered reservation is done via the normal loan-issue path server-side; a student-facing claim is `renewLoan`-adjacent but issuance itself is librarian-only, so this app can only re-poll {@link getMyReservations} to see `status` move to `Claimed` or `Expired`. */
  getMyFines(): Observable<FineDto[]> {
    return this.normalizeErrors(this.http.get<FineDto[]>(this.apiUrl('library/fines/me')));
  }

  /** Only *initiates* settlement (creates a Finance Invoice) -- `FineDto.status` flips to `Paid` asynchronously once the payment is confirmed; poll {@link getMyFines} to observe it. */
  settleFine(id: string): Observable<FineDto> {
    return this.normalizeErrors(
      this.http.post<FineDto>(this.apiUrl(`library/fines/${id}/settle`), {}),
    );
  }
}
