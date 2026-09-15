/**
 * `Content` module DTOs (SWEB-29), verified against `UMS.Modules.Content.Application/*` and
 * `UMS.Modules.Content.Api/Endpoints/NoticeEndpoints.cs`.
 *
 * **Bilingual representation (ADR-0011)**: the server never returns `titleEn`/`titleBn` pairs --
 * it resolves language server-side from the `Accept-Language` request header (already globally
 * propagated by this app's `localeInterceptor`, `core/http`) and returns exactly one
 * `title`/`body` pair plus `languageCode` naming which language actually won. A student who
 * requested Bengali but got English back (no translation row exists) is detected purely via
 * `languageCode !== 'bn'` -- there is no nullable "Bengali field" to check directly -- or via the
 * separate {@link NoticeDto.hasBengaliTranslation} flag (edge-cases.md "Missing Bengali
 * translation for a Notice").
 */
export interface NoticeDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly languageCode: 'en' | 'bn';
  readonly audience: readonly string[];
  readonly organizationNodeId: string | null;
  readonly isUrgent: boolean;
  readonly status: string;
  readonly publishAt: string | null;
  readonly expireAt: string | null;
  readonly publishedAt: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly hasBengaliTranslation: boolean;
  readonly version: number;
}
