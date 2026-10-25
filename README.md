# S.T.A.R.K.

**Structured Toolkit for Academic Research & Knowledge**

A personal student assistant that runs as a mobile app (Android) and in the browser. It's built to help with school work, starting with a DTR calculator and growing into a small toolkit of study tools.

> Status: early development. Only the Day Time Calculator exists so far.

## Features

| Tool | Status |
|---|---|
| Day Time Calculator (DTR) | In progress |
| Note Maker | Planned |
| Automatic PPT Maker | Planned |
| Flashcards | Planned |

### Day Time Calculator

Tracks rendered hours for a Daily Time Record (DTR), such as a scholarship duty sheet.

- **Table of entries:** Date, time in, time out, and hours per row, with the total shown as hours and minutes (e.g. `8h 30m`). Tap a cell to edit it.
- **Fingerprint clock-in/out:** The button in the middle of the taskbar records the current time. The first press clocks in, the next press clocks out, and the button turns green while you are clocked in.
- **Upload a photo of a paper DTR:** Pick a screenshot or photo from the gallery (phone) or a file (web). The app reads only the date and time-in/time-out columns, ignores the hours and signature columns, and skips the printed example row.
- **Scan DTR with the camera (phone, development build only):** Uses the native document scanner to find the page edges and clean up the image before reading it.
- **Review before adding:** Scanned rows appear on a review sheet with a running total. Rows that look wrong (missing time, very long, or unreadable date) are shown in red. Nothing is added until you confirm.

**How the reading works**

1. Text recognition returns each word with its position.
   - **Phone:** on-device ML Kit.
   - **Web:** Tesseract.js running in the browser.
2. A layout parser (`src/utils/dtr-layout.ts`) rebuilds the table from the positions. It finds the four time columns from the printed A.M. / P.M. headings and fixes common handwriting misreads such as `11;57` or `1|15|26`.
3. Times are converted from the sheet's 12-hour handwriting: A.M. columns stay as written, P.M. columns get 12 hours added.

> **Accuracy:** Both OCR engines are designed for printed text, so handwriting will sometimes be misread. Always check the review sheet. Hours are calculated from the times, not from the handwritten "No. of hours" column, so the total may differ from the number written on the sheet.

## Tech stack

- [Expo](https://expo.dev) (React Native) with [Expo Router](https://docs.expo.dev/router/introduction/)
- TypeScript
- `react-native-document-scanner-plugin` for camera scanning (native)
- `@infinitered/react-native-mlkit-text-recognition` for on-device OCR (native)
- `tesseract.js` for OCR in the browser
- `expo-image-picker` for choosing photos and files

## Getting started

### Requirements

- Node.js and npm
- An Android phone (for the mobile app) and/or a browser
- A free [Expo](https://expo.dev) account (only for cloud builds)

### Install

```bash
git clone https://github.com/Quakerfish/STARK.git
cd STARK
npm install
```

The repo includes an `.npmrc` with `legacy-peer-deps=true`. It's needed because the ML Kit package declares old React peer dependencies. Keep this file, and commit `package-lock.json` after changing dependencies.

### Run in the browser

```bash
npx expo start --web
```

Photo upload and web OCR work here. The camera scanner is hidden on web. The first scan downloads the OCR engine and English language data, so it needs an internet connection and takes longer.

### Run on a phone

**Expo Go** (quick check of the interface):

```bash
npx expo start
```

Expo Go does not include the scanner or ML Kit, so photo reading and camera scanning will show a message instead of working. Use the browser version, or the development build below.

**Development build** (everything works):

```bash
npx expo install expo-dev-client
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Install the APK from the link EAS prints, then run:

```bash
npx expo start --dev-client
```

Open the installed STARK app (not Expo Go). The phone and computer need to be on the same Wi-Fi, or add `--tunnel`.

Rebuild the development build whenever you add or change a native package. Normal code changes reload without a rebuild.

## Project structure

```
STARK/
├── app.json
├── .npmrc
└── src/
    ├── app/
    │   ├── _layout.tsx
    │   ├── index.tsx                 # Home
    │   └── day-time-calculator.tsx   # DTR screen
    ├── components/
    │   └── taskbar/taskbar.tsx       # Bottom bar, with the fingerprint button
    └── utils/
        ├── dtr.ts                    # Row type, formatting, hour calculations
        ├── dtr-scan.ts               # Scanned rows -> calculator rows, review flags
        ├── dtr-layout.ts             # Rebuilds the table from OCR word positions
        ├── ocr.ts                    # OCR on phones (ML Kit)
        ├── ocr.web.ts                # OCR on web (Tesseract.js)
        └── notify.ts                 # Alerts that also work in the browser
```

`ocr.ts` and `ocr.web.ts` export the same function. Expo picks the right file for each platform, so the screen code is shared.

## Known limitations

- Handwriting recognition is imperfect on both platforms. Rows are reviewed before they're added.
- Date and time editing on the web build may not work, because the date/time picker package doesn't support web.
- Entries are kept in memory only. Closing the app clears them. Saving data is not implemented yet.
- iOS has not been tried or set up.

## Roadmap

- Save entries on the device
- Export a DTR as a printable table or PDF
- Note Maker, Automatic PPT Maker, and Flashcards
- Optional backend for syncing between phone and web

## License

See [LICENSE](LICENSE).