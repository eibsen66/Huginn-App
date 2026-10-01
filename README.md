# Huginn App

Current standalone browser proof of concept:
https://github.com/eibsen66/Huginn-App

This existing repository is public. Its visibility is unchanged. The older copy
at `Huginn-Muninn/Huginn/App/poc` is a historical starter, not this current version.

## Restore and run on Windows

Install Git for Windows on the replacement PC, then run in PowerShell with
`C:\Huginn-App` absent:

```powershell
git clone --branch main https://github.com/eibsen66/Huginn-App.git C:\Huginn-App
Set-Location C:\Huginn-App
git rev-parse HEAD
Start-Process .\index.html
```

There is no compilation or npm installation. `index.html`, `app.js`,
`settings-package.mjs` and `style.css` are the complete static application
source. Optional offline checks, if Node.js is already available:

```powershell
node --test .\tests\settings-package.test.mjs
node --check .\settings-package.mjs
```

The PoC retrieves Info and Config using read-only HTTPS GET requests and provides
explicit cached views. Live retrieval requires reachable Huginn HTTPS service and
appropriate browser certificate/network permissions. Those device interactions
were not tested during source recovery. Opening the local UI does not establish
live connectivity. Browser-local cache and device credentials are not Git assets
and are not restored by cloning.

The combined EIS/App/Muninn Windows procedure is maintained in
[Muninn RESTORE.md](https://github.com/eibsen66/Muninn/blob/main/RESTORE.md).
That companion repository is private and requires authorized GitHub sign-in.

Source reviewed before recovery documentation: commit
`c511445e9f4c9d6e57de14cc1b968b0efc5ace57`. No App behavior was changed by the
documentation and ignore-rule setup.
