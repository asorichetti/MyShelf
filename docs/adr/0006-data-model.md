# 0006. v1 data model

- Status: Accepted
- Date: 2026-09-25

## Context

MyShelf must record books with edition-level detail, multiple authors, user-editable genres, series membership and position, user-created groups, and loans to people. The model must support grouping by genre, series, author and user groups, and enforce that a book is lent to at most one person at a time.

## Decision

Tables (full ER diagram and rules in `PLAN.md` §5):

- `books(id INTEGER PK, title, subtitle, isbn13, isbn10, edition, publisher, publication_year, page_count, summary, cover_uri, language, format, series_id FK, series_position REAL, source, source_id, notes, created_at, updated_at)`
- `authors(id, name, sort_name)`, `book_authors(book_id, author_id, role, position)`
- `genres(id, name UNIQUE)`, `book_genres(book_id, genre_id, user_edited)`
- `series(id, name, total_count)`
- `groups(id, name, colour, icon, created_at)`, `group_books(group_id, book_id, position)`
- `borrowers(id, name, contact)`, `loans(id, book_id, borrower_id, lent_on, due_on, returned_on, note)` with a partial unique index on `loans(book_id) WHERE returned_on IS NULL`
- `settings(key, value)`

Each row in `books` is one physical copy (a user can own two copies of the same ISBN). `series_position` is `REAL` to allow 2.5. Once `src/db/migrations` exists, the migrations are the source of truth.

## Consequences

- Grouping by author/genre/group is a join; by series is a column. All are indexed.
- The partial unique index makes "one open loan per book" a database guarantee, not just UI logic.
- Later additions (`api_cache`, `pending_lookups`, `books_fts`) come as new migrations in their phases.
- `user_edited` on `book_genres` lets metadata refreshes add genres without clobbering the user's choices.
