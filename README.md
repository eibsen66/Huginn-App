# HuginnAPP

Production target: signed Capacitor packaged iOS/iPhone and Android/Samsung apps. Slice 3B-Mobile adds the local native foundation only. No mobile build is qualified and the full ACK gate remains false.

Existing browser development proof of concept:
https://github.com/eibsen66/Huginn-App

This existing repository is public. Its visibility is unchanged. The older copy
at `Huginn-Muninn/Huginn/App/poc` is a historical starter, not this current version.

## Restore and run the Windows development harness

Install Git for Windows on the replacement PC, then run in PowerShell with
`C:\Huginn-App` absent:

```powershell
git clone --branch main https://github.com/eibsen66/Huginn-App.git C:\Huginn-App
Set-Location C:\Huginn-App
git rev-parse HEAD
Start-Process .\index.html
```

The static Windows/browser harness needs no compilation or npm installation. Mobile packaging uses the pinned Capacitor project described below. `index.html`, `app.js`,
`settings-package.mjs` and `style.css` are the complete static application
source. Optional offline checks, if Node.js is already available:

```powershell
node --test .\tests\settings-package.test.mjs
node --check .\settings-package.mjs
```

The PoC retrieves Info and Config using read-only HTTPS GET requests and provides
explicit cached views. It can also courier a locally verified Settings Transfer V1
file to the DEV HuginnEIS: verify with the device, preview device-computed changes,
then explicitly confirm apply. Preview and apply send the stored original bytes
without regenerating package JSON; only browser-local apply metadata is recorded
after device-confirmed success.

Live retrieval and DEV settings transfer require reachable Huginn HTTPS service,
the DEV root certificate trusted by the browser, and appropriate Wi-Fi permissions.
Opening the local UI does not establish live connectivity. Browser-local cache,
package storage, and device credentials are not Git assets and are not restored by
cloning.

The combined EIS/App/Muninn Windows procedure is maintained in
[Muninn RESTORE.md](https://github.com/eibsen66/Muninn/blob/main/RESTORE.md).
That companion repository is private and requires authorized GitHub sign-in.

Source reviewed before recovery documentation: commit
`c511445e9f4c9d6e57de14cc1b968b0efc5ace57`. No App behavior was changed by the
documentation and ignore-rule setup.

## Flight Courier local foundation

Slice 3B-Mobile adds pinned Capacitor 8.5.2 projects, native private SQLite and secure-credential services, a bounded local bridge, and an empty mobile qualification manifest. The existing HFL/IndexedDB modules and loopback launcher remain development/test tools.
See [FLIGHT_COURIER_3B.md](FLIGHT_COURIER_3B.md) for local APIs, tests and owner mobile build/qualification gates. Temporary development app ID: `is.huginn.foundation.dev`; final store identity needs owner approval. It adds no device Courier requests or ACK transport.
