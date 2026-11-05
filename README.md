# Doctor Pill

Doctor Pill is a browser-based medication reminder demo. It brings a medication list, prescription-time reminders, and a sample medication-box scanning flow into one responsive interface.

## Features

- Demo sign-in to a medication dashboard
- Add, edit reminder times for, and remove medication entries
- View upcoming prescription reminders for the next 24 hours
- In-app, browser, and spoken reminders where supported by the browser
- Camera preview and a preset sample scan result
- Responsive dashboard with medication and data-protection sections

## Run locally

No build tools or package installation are required.

1. Download or clone this project.
2. Open `index.html` in a modern browser.
3. Sign in with any valid email address and a non-empty password.

The sign-in is for demonstration only. It does not create or verify an account, and the password is not saved.

## Browser requirements

- The app uses browser `localStorage` to save medication entries on the current device and in the current browser. Clearing browser data removes them.
- Browser notifications and camera access require browser permission. Browsers generally require a secure context (HTTPS or localhost) for these features.
- Voice reminders depend on browser speech-synthesis support.
- The app loads its font and icons from Google Fonts and unpkg, so those assets require an internet connection.

## Important

This is a demonstration project, not a medical device or a clinical service. Example medications are mock data. Always check medication names, doses, and instructions against the prescription and follow advice from a qualified healthcare professional. Do not rely on this app as the only way to remember or manage medication.

The box scanner does not identify medication from the camera. It displays a preset demonstration result. The app has no user accounts, server, or cloud synchronization; medication entries are stored locally in the browser.

## Publish with GitHub Pages

This repository includes a GitHub Actions workflow that publishes the site whenever changes are pushed to `main`.

Before the first deployment, the repository owner must enable Pages:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push changes to `main`, or rerun **Deploy to GitHub Pages** from the **Actions** tab.

The workflow also attempts to enable Pages automatically, but repository or organization permissions may require the owner to complete the setup above. The published URL appears in the deployment details and in **Settings → Pages**.
