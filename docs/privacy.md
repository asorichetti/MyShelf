# MyShelf privacy policy

*Last updated: 26 September 2026. Applies to the MyShelf Android app, version 1.0 and later.*

MyShelf is a free, open-source app for cataloguing the books you own. It was written so that your library stays yours: **there are no accounts, no analytics, no advertising, no crash reporting and no MyShelf server.** The developer never receives any of your data.

The source code is public at <https://github.com/asorichetti/MyShelf>, so every statement below can be checked against it.

## What stays on your phone

Everything you put into MyShelf is stored only in the app's private storage on your phone:

- your books and everything about them (details, covers, notes, series and groups);
- loans and the names and contact details of the people you lend to;
- your settings;
- a copy of the library taken just before a backup is restored over it (for "Undo restore").

Android's automatic cloud backup is turned off for MyShelf, so this data is not copied to Google Drive either. Uninstalling the app, or **Settings → Erase library**, deletes it.

## What is sent over the internet, and to whom

MyShelf connects to the internet only to look up book details and covers, and only to these services:

| Host | Operated by | What MyShelf sends |
|---|---|---|
| `openlibrary.org` | [Open Library](https://openlibrary.org) (Internet Archive) | an ISBN, or the title and author words being searched for |
| `covers.openlibrary.org` | Open Library | a cover id or ISBN, to download a cover image |
| `www.googleapis.com` | [Google Books](https://books.google.com) | an ISBN, or the title and author words being searched for |
| `books.google.com` (or a regional Google Books domain) | Google Books | a Google Books volume id, to download a cover image |

These requests happen when you:

- scan or type an ISBN, or search by title and author;
- save a book (MyShelf fetches its cover);
- come back online after scanning offline (the ISBNs you scanned are looked up then);
- have books without a cover: now and then, a few at a time, MyShelf searches for a cover using the book's ISBN, or its title and first author.

**What is never sent:** your notes, series or groups, who borrowed what, borrowers' names or contact details, your photos, or the contents of your library as a whole. Nothing identifies you to these services beyond what any internet connection reveals (your IP address) and the app's name and version, which MyShelf sends as its User-Agent (`MyShelf/1.0.0 (+https://github.com/asorichetti/MyShelf)`) as the services ask.

Open Library and Google handle those requests under their own policies: the [Internet Archive's privacy policy](https://archive.org/about/terms.php) and the [Google Privacy Policy](https://policies.google.com/privacy).

You are in control:

- **Settings → Ask Google Books too** off: MyShelf asks only Open Library, for details and covers.
- **Settings → Fetch covers on mobile data** off: missing covers wait for Wi-Fi.
- Without a connection the whole app still works; only new lookups wait.

### The Google Books API key

A build of MyShelf may include a Google Books API key, chosen when the app is built, so that Google Books lookups do not share the public quota. It identifies the app to Google, not you, and it is sent only with Google Books requests. You never need to enter or create one. (**Settings → About MyShelf** says whether your build has one.)

### Links you tap

The About screen links to the MyShelf source code, Open Library and Google Books. Tapping one opens it in your browser; nothing is sent until you do.

## Camera and photos

- **Camera** (Android asks for permission the first time): used to read barcodes in the Scan tab and to photograph a book's cover. Barcodes are read on the phone by Google's ML Kit library, which is built into the app. The camera image is never uploaded. Google states that ML Kit may send it limited diagnostic information (such as device model, Android version, app version and performance figures), not the images; see [ML Kit's data disclosure](https://developers.google.com/ml-kit/android-data-disclosure).
- **Cover photos:** a photo you take or choose for a cover is saved in the app's private storage as that book's cover. A photo taken only to read a cover's text is deleted once it has been used.
- **Photos from your gallery** are chosen with Android's own picker, which gives MyShelf only the picture you pick. MyShelf has no access to the rest of your photos.

## Backups and exports

**Settings → Back up your library** (a JSON file) and **Export as a spreadsheet** (a CSV file) create a file and hand it to Android's share sheet. The file goes wherever you choose to save or send it (for example your Downloads folder, a cloud drive or an email), and is then covered by that service's own terms. A full backup contains everything in your library, including loans and borrowers' contact details, so keep it somewhere private. Restoring or importing reads only the file you pick.

## Notifications

Loan reminders are off unless you turn on **Remind me when loans are due** in Settings. MyShelf then asks Android for permission to post notifications, and schedules one reminder for each loan with a due date. Reminders are scheduled and shown by your phone alone ("local notifications"): nothing is sent to a server, and MyShelf does not use push notifications. A reminder shows the book's title and the borrower's name, so it may be visible on your lock screen, depending on your Android notification settings.

## Android permissions

| Permission | Used for |
|---|---|
| Camera | scanning barcodes and photographing covers |
| Internet, network state | looking up books and covers; knowing whether you are on mobile data |
| Notifications, run at startup | optional loan reminders, kept after a restart |
| Vibrate | a short buzz when a barcode is read |
| Storage (Android 12 and older only) | required by the camera picker on older Android versions; MyShelf does not read your files |

MyShelf does not ask for your contacts, location, microphone or advertising id.

## Children

MyShelf does not collect personal information from anyone, including children.

## Changes

Changes to this policy are made in this file, and its history is public in the repository. The date at the top shows the last change.

## Contact

Questions or concerns: open an issue at <https://github.com/asorichetti/MyShelf/issues>.
