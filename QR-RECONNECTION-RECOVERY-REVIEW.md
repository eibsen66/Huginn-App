# QR-endurheimt eftir misheppnaða endurtengingu

## Dreift með samþykki Egils — 2026-11-08

Fryst build **a2acd940a7370142** var dreift án endurbyggingar á `https://huginnapp-pwa-test.pages.dev`. Dreifing: `3cd057de-5428-4dc4-b8ae-a1c5f2c4bfb0`; óbreytanleg slóð: `https://3cd057de.huginnapp-pwa-test.pages.dev`.

Allar 32 frystar skrár voru sannreyndar fyrir og eftir upphleðslu. GET-sannprófun staðfesti canonical/immutable build.json og SHA-256 allra 30 birtu asset-skránna, þar á meðal entry, service worker, manifest og tákn. `_headers` er control-skrá sem Pages birtir ekki sem skrá; virk CSP var sannreynd. Engin eigandagögn eða upptökur voru opnuð eða hreinsuð.

Fyrri dreifing `3b6614f6-288e-4600-84d2-d96b978311ce`, build `efbccf3990a4390c`, er áfram tiltæk. Hash-sannreynt afrit er í `build/qr-recovery-review/publication/rollback-3b6614f6-288e-4600-84d2-d96b978311ce`. Fyrir-/eftir-sönnun: `publication/before.json` og `publication/after.json` undir sömu review-möppu.

Fyrsta API-athugun skilaði HTTP 401/code 10000, Authentication error. Núverandi Wrangler `whoami` tókst; endurtekið API-kall tókst í kjölfarið með núverandi OAuth. Engin credential override nöfn voru í process-umhverfinu. Engin handvirk innskráning, reikningsskipti eða credential-prentun fór fram.

Dreifingin sannar ekki virkjun í uppsettu iPhone-PWA eða líkamlega endurheimt. Engin COM-aðgerð, fastbúnaðaruppsetning eða stillingavistun fór fram. Fyrri undirbúnings- og prófunarskýrsla hér fyrir neðan er varðveitt sem söguleg skrá.

Til yfirferðar; ekki dreift. Engin tækjatenging, COM-aðgerð, fastbúnaðarbreyting eða vistun á raunverulegu tæki fór fram.

## Staðfest endursköpun

Nýja Edge-vafraprófið `tests/pwa-qr-recovery-browser.test.mjs` var keyrt gegn frystu fyrri útgáfunni `efbccf3990a4390c`. Eftir heppnaða pörun var hermt sambandsrof án 401/403. Endurtenging mistókst á meðan heimild var enn í minni. Prófið féll við: `Fresh QR must remain visible after reconnect fails without 401/403`.

Orsök þessarar endursköpuðu UI-bilunar: fyrri tenging faldi pörunarhlutann; endurtenging með heimild í minni reyndi áfram skráalistalestur og opnaði ekki QR-leiðina við almennri samskiptabilun. Þetta er ekki sönnun á nákvæmri orsök símabilunarinnar 8. nóvember eða því að heimildin þar hafi verið útrunnin.

## Afmörkuð breyting

- `pwa/index.html`: sýnilegur endurheimtarhnappur utan falda pörunarhlutans, **Para aftur með QR / Pair again with QR**.
- `pwa/entry.mjs`: hnappurinn birtist við rofna tengingu og er áfram tiltækur meðan ný endurtenging bíður. **Tengjast aftur / Reconnect** helst í boði. Eftir heppnaða tengingu hverfur QR-endurheimtarhnappurinn.
- QR-valið fer um sömu skönnun, QR-sannprófun og sjálfvirku tengingu og áður. Það notar núverandi `disconnectSource({keepDraft:true})`: fellir niður beiðnir, hækkar tengingar-/aðgerðakynslóð, lokar fyrri source og hreinsar fyrri heimild úr minni. Eldri svör geta ekki yfirskrifað nýju tenginguna.
- Drög varðveitast; núverandi settings-suspend/reset varnir krefjast nýs heils ritilslesturs áður en vistun verður virk. Engin skrif eru endurtekin sjálfkrafa.

## Prófanir

Lokakeyrsla: **20 próf, 20 staðin, 0 fallin, 0 felld niður**. Skrá: `build/qr-recovery-review/focused-tests.log`.

```powershell
node --test --test-concurrency=1 tests/pwa-qr-recovery-browser.test.mjs tests/pwa-auto-pairing-browser.test.mjs tests/reconnect-source.test.mjs tests/settings-connection-lifecycle.test.mjs tests/pwa-freshness-browser.test.mjs tests/pwa-field-save-browser.test.mjs tests/pwa-storage-integrity.test.mjs tests/pwa-update-recovery.test.mjs tests/pwa-icons.test.mjs
```

Nýja prófið nær yfir heimild sem helst í minni eftir rof, timeout, rofið HTTP 200 svar, QR-pörun með nýjum tilbúnum token án endurræsingar, seint 401-svar úr fyrri tengingu, varðveislu birtudraga, óvirka vistun fyrir nýjan lestur, endurtengingu með gildri heimild og endurpörun eftir móttekið 401. Engin `/apply` beiðni er send í því prófi.

Önnur lokapróf ná yfir 403, QR-villur/tvítekna skönnun/niðurfellingu, einnar stillingar og heildarvistun með hermdum bilunum, óháðan greiningarlestur, geymslu/heilleika, kvóta/samhliða notkun, raunverulega worker-endurnýjun og offline-endurheimt í einangruðum Edge-prófílum. Þetta er host/vafrasönnun, ekki iPhone-prófun.

`node --check` stóðst fyrir breyttan entry-kóða og nýja vafraprófið. Upphafleg prófunarrammi þurfti leiðréttingu: rofið svar þarf að vera hermt í fetch-fallinu sem source tók við þegar það var búið til; einnig sýnir núverandi heimildarvilluleið pörunarhlutann en varðveitir ekki `AUTH_REQUIRED` í sameiginlega villukóðareitnum. Lokaprófið athugar rétta sýnilega pörunarstöðu. Fyrri fallin keyrsla er varðveitt í `initial-test-expectation-failure.log`; endursköpun gamla appsins í `baseline-reproduction.log`.

Sögulega **FIRMWARE_HEAD** prófbilunin er áfram skráð sem bilun. Vörn hennar var ekki breytt, hún var ekki endurkeyrð hér og er ekki talin meðal staðinna prófa.

## Fryst útgáfa

- Build: **a2acd940a7370142**.
- Mappa: `C:/HuginnAPP/build/qr-recovery-review/candidate-a2acd940a7370142`.
- Allar **32 skrár** hafa skráða stærð og SHA-256 í `build/qr-recovery-review/reviewed-candidate.json`.
- SHA-256 á `build.json`: `aca82f543b25ffe0ba44bf6a5ab9ca53c793e9df2b79d97967af641651377165`.
- Samanburður við fryst `efbccf3990a4390c`: aðeins `index.html`, `entry.mjs`, `sw.js` og `build.json` breyttust. Worker-breytingin er eingöngu build-auðkennið. Allar aðrar skrár eru bæti fyrir bæti óbreyttar, þar á meðal settings/source, storage/adapter, manifest, tákn og FLG-prófgögn. `FULL_ACK_GATE_PASS=false`.

Endursannprófun án endurbyggingar eða dreifingar:

```powershell
Set-Location C:/HuginnAPP
node scripts/freeze-qr-recovery-candidate.mjs --verify
```

## Takmörk og næsta samþykki

Útgáfan er aðeins undirbúin til yfirferðar. Dreifing og tækjaprófun bíða samþykkis Egils. Ekkert browser-data clear eða enduruppsetning er hluti af uppfærslunni.

Eftir sérstakt samþykki þarf iPhone-samþykkisprófun að staðfesta nýtt app og báða worker-reiti, sýnilega QR-endurheimt eftir misheppnaða endurtengingu og nýja QR-tengingu án þess að loka appinu. Vistun skal vera óvirk þar til heill ritilslestur tekst. Engin raunveruleg vistun er hluti þessa verks.

DMA-bilanir GET nr. 10 og 11 í Rev. 2.8 upptökunni eru aðskilið mál og voru ekki lagaðar hér. Fyrri heppnaða óvaranlega POST-prófunin sannar ekki endurtekna áreiðanleika eða að þessi appbreyting lagi Settings-flutning.
