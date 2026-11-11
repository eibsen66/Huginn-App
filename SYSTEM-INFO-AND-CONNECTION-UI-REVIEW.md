# HuginnAPP — fyrsta QR-tenging, handvirkur gluggi og System Info

## Nákvæm uppfærsla úr a2acd940a7370142 staðfest í vafraprófi

Canonical var endurathugað 2026-11-09 23:28:40 UTC: build og allar birtar asset-skrár, þar á meðal worker, samsvara **6a2d2ea1505b8acf**. Engin endurdreifing eða endurbygging var nauðsynleg.

Nýtt `tests/pwa-system-info-upgrade.test.mjs` próf stóðst með **óbreyttum frystum skrám beggja útgáfna**, sama loopback-origin og sama disposable Edge-prófíl. Gamli workerinn og cached gamla viðmótið voru virkt fyrst. Venjuleg navigation lét gamla appið skrá/uppgötva nýjan worker; síðan var raunverulegi **Stillingar → Stillingar apps → Uppfæra HuginnAPP** hnappur þess notaður. Prófið kallaði ekki registration.update(), skipWaiting eða activation message sjálft og breytti ekki cache eða storage til að knýja fram uppfærslu.

Eftir smellinn birtist System Info og **App build / Active Service Worker / Controlling Service Worker voru öll 6a2d2ea1505b8acf**. Tvær synthetic COMPLETE/INCOMPLETE FLG-skrár héldu nákvæmum export-bætum og metadata; NO-ACK gate var áfram false. Offline reload nýja viðmótsins og sömu exports stóðust. Engin data clear eða reinstall fór fram. Þetta er prófun í Chromium/Edge, **ekki staðfesting á virkjun í iPhone/WebKit**. Enginn endurskapaður updater-kóðagalli fannst, svo samþykktu frozen bytes voru ekki breytt.

Gögn: `build/system-info-review/exact-upgrade-tests.log` og `upgrade-check/result.json`. Skjáskot: [gamli uppfærsluhnappurinn](build/system-info-review/upgrade-check/old-update-button.png) og [nýtt System Info eftir uppfærslu](build/system-info-review/upgrade-check/new-system-info.png). Allar 32 frystu skrárnar voru endursannreyndar óbreyttar á eftir. Þetta viðbótarpróf er aðskilið frá upprunalega 45-prófa frozen receipt.

Eina uppfærsluaðgerð eiganda: með Interneti, öðrum HuginnAPP-gluggum lokuðum og enga virka aðgerð í gangi, velja **Stillingar → Stillingar apps → Uppfæra HuginnAPP** í sama uppsetta appinu. Eftir það þarf eigandi að staðfesta System Info og þrjá 6a2d2ea1505b8acf útgáfureiti á símanum; það er ekki hægt að fullyrða úr host-prófinu að síminn hafi þegar virkjað uppfærsluna.

## Canonical-sannprófun lokið

Eftir endurnýjað samþykki Egils voru allar **32 frystu skrárnar** endursannreyndar. Fyrirliggjandi dreifing **954cd6e2-d02e-480a-b98d-71f59fe6dd6f** birtir nú rétt build **6a2d2ea1505b8acf** á **https://huginnapp-pwa-test.pages.dev**. Canonical og immutable build.json eru eins; SHA-256 allra **30 opinberu asset-skránna**, þar á meðal index/entry/style/version-info, service worker, manifest og tákn, stóðst. Virk CSP var einnig sannreynd.

Engin endurbygging eða tvítekin upphleðsla var nauðsynleg í þessari lotu. Fyrra ósamræmið mælist ekki lengur; nákvæm orsök þess er ekki staðfest. Ný sönnun: `build/system-info-review/publication/after.json`.

Rollback **3cd057de-5428-4dc4-b8ae-a1c5f2c4bfb0 / a2acd940a7370142** er áfram tiltækt í API og immutable build þess óbreytt. Staðbundið rollback-afrit er varðveitt. Engin browser-gögn, firmware eða COM-port voru snert. Public deployment checks sanna ekki að iPhone hafi virkjað uppfærsluna; nota venjulega uppfærsluleið án gagnahreinsunar eða enduruppsetningar.

Fyrri pending-staða hér fyrir neðan er varðveitt sem söguleg skrá.

## Samþykkt upphleðsla — canonical-sannprófun ólokið

Egill samþykkti dreifingu og nákvæm fryst útgáfa **6a2d2ea1505b8acf** var send einu sinni, án endurbyggingar, á account `afc733ae88054c22d7214b083132bfbc`, Pages project `huginnapp-pwa-test`, branch `main`. Allar 32 skrár voru hash-sannreyndar fyrir og eftir upphleðslu.

Cloudflare API staðfestir production deployment **954cd6e2-d02e-480a-b98d-71f59fe6dd6f**, status `success`. Immutable slóð `https://954cd6e2.huginnapp-pwa-test.pages.dev` birtir rétt build og allar 30 opinberu asset-skrárnar voru SHA-256 sannreyndar, þar á meðal nýja UI-ið, version-info, worker, manifest og tákn. `_headers` var sent sem control input.

**Síðasta GET-athugun 2026-11-09 23:20:48 UTC:** canonical `https://huginnapp-pwa-test.pages.dev` birtir enn **a2acd940a7370142**. index.html, style.css, entry.mjs, version-info.mjs og sw.js þar samsvara ekki nýju útgáfunni. Venjulegar og query-breyttar GET-beiðnir með no-cache sýndu sama ósamræmi; bounded endurathuganir breyttu ekki niðurstöðunni. Því er **ekki staðfest að nýja PWA-uppfærslan sé tiltæk á canonical-slóðinni**. Ekki er fullyrt að þetta sé cache- eða propagation-orsök; það er mælt ósamræmi milli control-plane/immutable og stable public-svars. Engin purge, endurdreifing eða configuration-breyting var framkvæmd.

Fyrri dreifing **3cd057de-5428-4dc4-b8ae-a1c5f2c4bfb0 / a2acd940a7370142** er áfram staðfest tiltæk í API og á immutable slóðinni `https://3cd057de.huginnapp-pwa-test.pages.dev`. Hash-sannreynt staðbundið rollback-afrit er í `build/system-info-review/publication/rollback-3cd057de-5428-4dc4-b8ae-a1c5f2c4bfb0`.

Gögn: `publication/before.json` og `publication/routing-verification.json` undir review-möppunni. Fyrsta API-kall skilaði 401/code 10000; núverandi Wrangler whoami tókst og API-köll virkuðu á eftir, án nýrrar handvirkrar innskráningar eða credential-prentunar. Public checks eru ekki physical phone validation. Engin firmware/COM/settings aðgerð fór fram og browser-gögn voru ekki hreinsuð.

**iPhone-prófið bíður þess að canonical build og worker séu staðfest á 6a2d2ea1505b8acf.** Ekki nota immutable slóð sem nýtt installation-origin eða endursetja PWA-ið til að komast fram hjá þessu ósamræmi. Eftir þá staðfestingu: venjuleg idle update á nettengdu neti, App/Active/Controlling öll á rétt buildi; síðan einn QR-smellur, reconnect eftir sambandsrof, opna/loka manual dialog, athuga version frá báðum flipum og skoða System Info/persistence-help. Engin settings-vistun eða COM-aðgerð er hluti þess prófs.

Upprunalega undirbúningsskýrslan er varðveitt hér á eftir sem söguleg skrá.

Fryst til yfirferðar: **6a2d2ea1505b8acf**. Ekki dreift. Viðmið: fryst a2acd940a7370142. Engin tækjaprófun, COM-aðgerð, firmware-breyting, commit eða push fór fram. Raunveruleg browser-/eigandagögn voru ekki opnuð eða hreinsuð.

## Útfært í virku PWA-inntaki

- `pwa/index.html`, `pwa/entry.mjs`: **Skanna QR og tengjast** er sýnilegt strax og ein snerting ræsir núverandi scanner. Gamla fyrstu-tengingar milliskrefið er ekki sýnt. Sami open-connection handler er varðveittur fyrir **Tengjast aftur**; **Para aftur með QR** er áfram í endurheimtarferlinu.
- **Tengja án QR-kóða** er neðan tengihnappanna í HuginnEIS-spjaldinu. Hann opnar native dialog með núverandi trust-profile, source-origin og pairing-JSON reitum, leiðbeiningum, Tengjast og staðbundinni villustöðu. Engin ný tengiaðferð er innleidd. Loka/Escape hreinsar ónotað pairing-input; við biðandi tengingu fellir lokun hana niður með núverandi epoch/source-vörnum. Seint svar getur ekki yfirskrifað nýja QR-tengingu. Við árangur lokast glugginn og HuginnEIS-flipinn með skráalista birtist.
- `pwa/version-info.mjs`: báðir **Athuga útgáfu og geymslu** hnappar bindast sama guarded refresh-falli. Þeir birta sömu stuttu staðfestingar-/ósamræmis-/óstaðfestingar-/villuniðurstöðu. Samhliða smellir eru sameinaðir. Athugunin les worker-auðkenni og shell-cache; hún setur ekki upp uppfærslu, virkjar ekki worker og skrifar ekki flight storage.
- Nýr **System Info** flipi er hægra megin við Stillingar. Tæknilegar upplýsingar eru opnar efst; Útgáfa og offline-geymsla er opin neðar á sömu síðu með núverandi útgáfureitum. Prófunargögn og geymslugreining er flutt þangað, áfram í lokanlegum test-tools kafla. Engin Ítarlegt- eða tvítekin technical/version/storage trjágerð er eftir undir Stillingar. Settings diagnostics og upplýsingar um sótt device-settings eru áfram með ritlinum.
- `pwa/style.css`: fjögur heil flipanöfn rúmast í síma; manual-dialog er hæðartakmarkaður og skrunanlegur. Fyrirliggjandi safe-area CSS, lógó, litir og file rows eru varðveitt.

Flipaskipti fela DOM-panel eingöngu; tenging, biðandi aðgerðir og drög eru ekki endurræst. Ein virk source-tenging, QR/TLS/auth validation, protected-time exclusion og no-automatic-write-replay eru óbreytt.

## Varðveisla skráa

Kóðaskoðun staðfesti að takkinn kallar á `navigator.storage.persist()`. Hann tekur ekki afrit, flytur ekki skrár og notar ekki storage-estimate sem loforð um retention. Upplýsingatextinn beint undir takkanum er orðalagið sem Egill gaf, með réttum íslenskum stöfum og enskri útgáfu.

Við hnappinn eru aðgreindar niðurstöður fyrir samþykki vafrans, beiðni sem var ekki samþykkt og vafra án stuðnings. API-villa fær einnig sérstakan mannamálstexta; fyrri sanitized technical error handling er varðveitt á System Info. Unsupported takki helst óvirkur líka eftir local Verify/export. Samþykki er ekki fullyrðing um varanlega geymslu eða öryggisafrit.

## Prófanir — raunverulega keyrðar

**45 próf stóðust, 0 féllu, 0 cancelled.** Logg: `build/system-info-review/focused-tests.log`.

```powershell
node --test --test-concurrency=1 tests/pwa-system-info-browser.test.mjs tests/pwa-qr-recovery-browser.test.mjs tests/pwa-auto-pairing-browser.test.mjs tests/pwa-version-info.test.mjs tests/version-info-shared-actions.test.mjs tests/pwa-icelandic-ui.test.mjs tests/pwa-field-save-browser.test.mjs tests/pwa-freshness-browser.test.mjs tests/pwa-storage-integrity.test.mjs tests/pwa-storage-pressure.test.mjs tests/pwa-update-recovery.test.mjs tests/pwa-icons.test.mjs tests/reconnect-source.test.mjs
```

Nýja browser-prófið keyrir actual byggt PWA með einangruðum Edge-prófíl, raunverulegum worker/IndexedDB, synthetic camera og HTTP/protocol fixtures. Það prófar:

1. Sýnilegt fyrsta QR-val; einn scanner-smellur og sjálfvirk tenging eftir QR-validation.
2. Fjóra flipa, sýnilega System Info-kafla, íslensk/ensk flipanöfn og ekkert lárétt skrun við **320, 375, 390 og 430 px**.
3. Sömu version-check aðgerð frá báðum flipum og sömu stuttu niðurstöðu. Sérstakt unit-próf staðfestir coalescing, busy/disabled stöðu og bæði error/mismatch feedback.
4. Handvirkan glugga, invalid JSON villu, lokun/secret-field cleanup, heppnaða manual tengingu með nýjum synthetic token, lokun við pending request og seint 401 eftir nýja QR-tengingu.
5. Fyrirliggjandi Reconnect og QR recovery; drög lifa manual/source skipti og nýr heill stillingalestur þarf að fara fram áður en vistun opnast. Nýja UI-prófið sendir enga apply-beiðni.
6. Granted/denied/unsupported/exception persistence. Synthetic staðbundin FLG helst eftir tengiskipti og app-reload án data clear.

Önnur próf ná yfir per-field/bulk save með hermdum bilunum og reconciliation, strict fresh-read gate, expired authorization, delayed responses, exact-byte storage/export/restore, quota/concurrency, worker-update/offline recovery, icons og canonical build hashes. Engin raunveruleg settings-vistun eða firmware-prófun fór fram. Test fixtures fyrir protocol koma frá fyrirliggjandi staðbundnu host-líkani; fyrra host model/pins voru varðveitt áður en fixture var samstillt við núverandi source pins. Source-pin vörnin var ekki veikluð.

Eldri collapsed-UI og persistence-copy væntingar í viðkomandi prófum voru uppfærðar að samþykktri nýrri hegðun; integrity/security assertions haldast. Upphaflegar villur í nýja prófunarrammanum (top-level await í fixture import og bið eftir nýju document við unsupported mock) voru leiðréttar áður en lokakeyrsla stóðst. Eldri passing 44-prófa keyrsla er varðveitt sem previous-a8254646d9b3b832-tests.log.

Sögulega **FIRMWARE_HEAD** bilunin er óbreytt, ekki endurkeyrð og ekki talin meðal staðinna prófa.

## Skjáskot til útlitsyfirferðar

Öll eru **390×844**, úr lokabuildinu, tekin í headless Edge með tilbúnum gögnum. Þau eru ekki ljósmyndir eða raunpróf af iPhone. Öll sex voru skoðuð sjónrænt yfir vinnuna; endanleg System Info/manual skjáskot voru einnig endurskoðuð eftir lokabuild.

- [HuginnEIS — fyrsta tenging](build/system-info-review/screenshots/01-huginn-initial.png)
- [System Info — opnir kaflar og útgáfa](build/system-info-review/screenshots/02-system-info-top.png)
- [Varðveisla skráa — upplýsingatexti og samþykkt niðurstaða](build/system-info-review/screenshots/03-storage-help.png)
- [Sóttar skrár — synthetic fixture, rétt merkt](build/system-info-review/screenshots/04-downloaded-files.png)
- [Handvirkur tengigluggi](build/system-info-review/screenshots/05-manual-connection.png)
- [Stillingar — óvistað synthetic draft](build/system-info-review/screenshots/06-settings.png)

## Fryst skrár og varðveisla

- Build: **6a2d2ea1505b8acf**.
- Candidate: `C:/HuginnAPP/build/system-info-review/candidate-6a2d2ea1505b8acf`.
- Allar **32 skrár**, stærðir og SHA-256: `build/system-info-review/reviewed-candidate.json`.
- SHA-256 á build.json: `ef9cbe15cf91b8c94fe1efd21e95f1c60c5a7b061613e274868cd9026c459b73`.
- Samanborið við a2acd940a7370142 breyttust aðeins index.html, entry.mjs, style.css, version-info.mjs, sw.js og build.json. Worker-breytingin er eingöngu canonical build-auðkennið. Öll önnur asset-byte eru eins: source/settings protocol, settings editor/guards, adapter/storage, manifest, samþykkt tákn/lógó, fixtures og _headers.
- Sama PWA identity, scope og IndexedDB-nafn/version; engin migration eða data clear. FULL_ACK_GATE_PASS=false og NO-ACK merkingar eru óbreyttar.

Sannprófun án endurbyggingar eða dreifingar:

```powershell
Set-Location C:/HuginnAPP
node scripts/freeze-system-info-candidate.mjs --verify
```

## Síðar samþykkisferli — ekki óskað eftir tækjaprófi nú

Dreifing og raunprófun bíða samþykkis Egils. Eftir síðar samþykkta dreifingu: uppfæra sama installed PWA án data clear/reinstall; staðfesta App/Active/Controlling build; skoða fjóra flipa, fyrsta QR-smell og manual dialog; skoða version check frá báðum flipum og persistence-copy. Tenging/QR við tæki bíður einnig samþykkis. Ekki er fullyrt að iOS camera permission, keyboard/safe-area hegðun eða browser retention grant hafi verið staðfest á síma.

Fyrri Settings POST-/DMA-/admission rannsóknir eru óháðar þessari UI-breytingu. Enginn árangur í þeim er fullyrtur hér.
