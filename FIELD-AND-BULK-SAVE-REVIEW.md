# Vistun við hvern reit og heildarvistun — 7. nóvember 2026

## Samþykkt dreifing — lokið 7. nóvember 2026

Eftir skýrt samþykki Egils var nákvæmlega frysta útgáfan **3f1a35d5e2fe39bd** birt á **https://huginnapp-pwa-test.pages.dev**, án endurbyggingar. Deployment **c0670d3c-f34b-4828-93fc-26c9cc74d94b**; immutable slóð **https://c0670d3c.huginnapp-pwa-test.pages.dev**.

Allar **32 skrár**, stærðir og SHA256 voru sannreynd fyrir upphleðslu og aftur eftir hana. Authenticated Cloudflare GET staðfesti rétt project/production identity og success. Canonical/immutable build.json samsvara candidate; allar **30 opinberar manifest-skrár** samsvara frystum bætum, þ.m.t. stillingamátar, HTML, service worker, manifest og táknmyndir. JavaScript MIME og raunverulegt CSP voru sannreynd. `_headers` er óopinber stýriinntaksskrá, hlaðin sérstaklega upp af Wrangler.

Bakfærsla **ed68bd11-ba85-45e5-9894-e844e8fe8b09 / 9dce699595b724ea** er áfram til í Cloudflare með óbreyttu immutable manifesti. Heilt sannreynt afrit er undir `build/field-save-review/publication/rollback-ed68bd11-ba85-45e5-9894-e844e8fe8b09`. Kvittanir: [before.json](build/field-save-review/publication/before.json), [after.json](build/field-save-review/publication/after.json).

Fyrsta API-tilraun skilaði HTTP 401/code 10000 Authentication error. Venjuleg endurnýjun núverandi Wrangler OAuth með `whoami` leysti aðganginn; síðari GET-athuganir og dreifing tókust. Enginn reikningur eða heimildir voru breytt og engin leyndarmál birt. Engin endursmíði, fastbúnaðarbreyting, COM-aðgerð eða vistun á tæki fór fram. Browser-gögn og niðurhalaðar skrár eiganda voru ekki opnuð eða breytt. FIRMWARE_HEAD er áfram fallið óbreytt; POST-flutningsbilunin er enn óleyst.

Undirbúningsskýrslan hér fyrir neðan er söguleg. Orðalag hennar um ódreifða útgáfu er leyst af hólmi með þessari dreifingarkvittun. Raunprófun á iPhone er ekki talin lokið.

### Uppfærsla uppsetts iPhone-PWA — án gagnahreinsunar

1. Vertu á nettengdu neti og opnaðu núverandi uppsetta HuginnAPP á sama canonical uppruna. Hafðu enga flutnings-/pörunar-/vistunaraðgerð í gangi og lokaðu öðrum HuginnAPP-gluggum. Uppfærsla endurhleður viðmótið; skráðu óvistuð drög hjá þér ef þau eru enn opin. Ekki vista þau á tæki til að uppfæra appið.
2. Í **Stillingar → Stillingar apps**, veldu **Uppfæra HuginnAPP** þegar boðið er upp á það og leyfðu venjulegri endurhleðslu að ljúka. Ef uppfærsla hefur ekki enn fundist, opnaðu appið aftur meðan það er nettengt og athugaðu aftur. Ekki hreinsa website-gögn, afskrá worker eða fjarlægja appið.
3. Í **Ítarlegt → Útgáfa og offline-geymsla**, veldu **Athuga útgáfu og geymslu**. **App build**, **Active Service Worker** og **Controlling Service Worker** eiga öll að sýna **3f1a35d5e2fe39bd**. Upplýsingatakkinn setur ekki sjálfur inn uppfærslu. Athugaðu offline-cache-stöðuna áður en þú yfirgefur nettengda netið.
4. Stillingasíðan á að sýna **Vista allar breytingar** neðan við tækisstillingareitina og hvorki **Forskoða breytingar** né **Staðfesta og vista**. Hnapparnir **Vista breytingu** eru búnir til þegar raunverulegar stillingar eru sóttar; þeir verða því staðfestir í seinni lotunni þinni, **eftir að þú hefur sjálfur ræst COM5-capture og séð ARMED**. Ekki sækja stillingar eða ýta á vistunarhnapp sem hluta af þessari dreifingarstaðfestingu.

Vistun á raunverulegu tæki bíður sérstakrar heimildar eiganda. Engin ný capture- eða símaprófun var framkvæmd af aðstoðarmanni.

**Til yfirferðar, ekki dreift: `3f1a35d5e2fe39bd`.** Engin COM-aðgerð, prófun eða vistun á raunverulegu tæki, fastbúnaðarbreyting, fastbúnaðarsmíði, endurræsing, commit eða push. COM10, SD-rannsókn og eldri gögn eru óhreyfð.

## Nýtt ferli

- **Vista breytingu / Save change** undir hverjum breytanlegum V2-reit. Það velur aðeins viðkomandi gildi úr drögunum. Önnur drög fylgja ekki beiðninni.
- **Vista allar breytingar / Save all changes** neðan við stillingareitina. Allar breytingar fara saman í núverandi atómísku samskiptaleið. Ógildir/ófullgerðir reitir eru merktir og stöðva heildarvistun. Enn má vista annan gildan reit sérstaklega.
- Innsláttur uppfærist strax með `input`/`change` eftir tegund reits. **Óvistað** og nýtt gildi sjást við reitinn án blur. Tímabundið tómt/ógilt tölugildi helst óbreytt í reitnum; því er ekki breytt í núll. Endurnýting DOM-reita varðveitir fókus og bendil.
- **Engar sjálfvirkar POST-beiðnir meðan slegið er inn.** Einn vistunarsmellur keyrir fyrirliggjandi óvaranlega server-staðfestingu og síðan apply, án aukaskrefs í viðmóti. Gömlu Preview/Confirm-takkarnir og tveggja skrefa leiðbeiningarnar eru ekki í viðmótinu.
- Óbreyttar samskiptavarnir staðfesta fulla svörun, skema, auðkenni, tengingu, grunnútgáfu, SHA og nákvæm tillögugildi. Sama kanóníska bætaruna fer í staðfestingu og apply. Sérhver vistun notar aðskilda tímabundna lotu; endurteknir smellir og samtímis vistun eru stöðvuð.
- **Vistað** birtist aðeins fyrir gildi sem endurlestur úr tækinu staðfestir. Nýrri innsláttur meðan beiðni er í gangi er annað staðbundið drag og verður ekki hreinsaður með svari eldri beiðni.
- Reitir sem krefjast samhæfðra breytinga geta verið háðir öðrum reitum. Ef server-staðfestingin leggur til raunverulegar breytingar utan valdra draga er vistun stöðvuð **fyrir skrif** með skýrri reitavillu. Appið tekur ekki önnur drög eða óumbeðnar afleiddar breytingar með í kyrrþey. Þetta varðveitir gildissvið vistunar í stað þess að veikja reglur tækisins.

## Rofið svar og endurlestur

Eftir að apply gæti hafa verið sent geymir appið valin auðkenni og nákvæm send gildi í vinnsluminni, bundin við tæki/uppruna. Rofið eða ógilt apply-svar leiðir í **Staðfesti vistun… / Confirming save…** og endurlestur — aldrei sjálfvirka endursendingu skrifa.

- Ef öll valin gildi samsvara endurlestri: þau eru staðfest; aðeins samsvarandi gömul drög eru hreinsuð. Önnur drög og nýrri innsláttur haldast.
- Ef aðeins hluti samsvarar: staða hvers reits er sýnd; heildarniðurstaðan er ekki merkt fullbúin. Reitir sem passa ekki halda drögunum og sýna gildi tækisins með viðeigandi einingum.
- Ef endurlestur bregst: **Óvíst hvort vistun tókst**; frekari vistun er lokuð og **Lesa stöðu aftur / Read status again** er í boði. Nýr endurlestur sendir aðeins GET. Þegar gild endurlesin staða fæst má eigandinn ákveða næstu vistun sérstaklega.
- Ef tenging rofnar eftir skrif: seint svar gömlu tengingarinnar getur ekki merkt reit Vistað. Endurtenging þarf ferskan lestur; óvissa og örugg drög haldast í minni. Útrunnin pörunarheimild leiðir í fyrirliggjandi nýja QR-pörun.
- Tæknileg JSON-greining helst í samanbrotnu Greiningar-svæði í venjulegu vistunarferli. Engin hrá svör, bearer-leyndarmál eða pörunargögn eru sett í villuskilaboð reita.

## iPhone: hvers vegna gamla viðmótið gat enn birst

Staðfest í þessari lotu með venjulegum TLS GET-beiðnum: canonical `https://huginnapp-pwa-test.pages.dev` og immutable `https://ed68bd11.huginnapp-pwa-test.pages.dev` skila sama frysta **9dce699595b724ea** manifestinu. Allar 30 opinberar skrár samsvara varðveittum tætigildum, þar á meðal HTML, stillingamátar og worker. Sú frysta HTML hefur ekki gamla Preview-hnappinn. Nýja útgáfan hefur ekki verið dreift. Cloudflare API-auðkenni var ekki endurspurt nú; fyrra deployment-auðkenni er varðveitt í afhendingargögnum.

Fyrirliggjandi worker þjónar eigin skyndiminni fyrst. Nýtt deployment skiptir því ekki sjálfkrafa út virku skjali á iPhone. Nýr worker getur beðið eftir virkjun; fleiri opnir gluggar geta stöðvað virkjun. Á HuginnEIS Wi-Fi án internets er ekki hægt að sækja nýja útgáfu sem vantar í skyndiminni. **Athuga útgáfu og geymslu** les upplýsingar en setur ekki sjálft inn uppfærslu.

Raunverulegt worker-próf í einangruðum Edge-vafra byrjaði með varðveittri **a891e07022384c69** tveggja skrefa útgáfu, setti nýju útgáfuna í bið og staðfesti að gamla Preview-viðmótið var enn sýnilegt. Eftir venjulega virkjun kom nýja vistunarviðmótið fram, gömlu asset-skyndiminni vék og IndexedDB-skrár og nákvæmir útflutningsbætar héldust. Bilandi uppfærslur skildu fyrri nothæfan worker eftir. Offline enduropnun í nýju vafraferli virkaði.

Þetta sýnir studda skýringu á gömlu viðmóti eftir deployment, **ekki sannaða orsök skjáskots eigandans**. Enginn aðgangur var að uppsetta iPhone, virkum skjölum þess, worker eða skyndiminni. Staðfesting á opinberu `build.json` er ekki staðfesting á virku appi símans. Útgáfugreining appsins ber saman app/HTML/worker og athugar tilvist asseta; hún sannar ekki sjálf SHA256 hvers skyndiminnisbæta. Ef rétt build er sýnt en gamlir takkar sjást þarf símasértæk staðfesting á sama uppruna/glugga og virku innihaldi. Ekki hreinsa gögn eða setja upp aftur.

## Varðveitt COM5-gagn — engin ný tækjaprófun

Hráupptaka `C:/HuginnEIS/Evidence/REV2.7-COM5/console-20261107T113038Z/console.raw`, 6.880 bæti, SHA256 **14f28bf4f3eec7ae0d724146dca95785ffee46500ca2821274afa382f3d740e9** er óbreytt.

- GET-lestur nr. 16 sendi 29.502 bæti án skráðrar úthlutunarbilunar innan þeirrar GET-mælingar.
- Tvær almennar AES-úthlutunarvillur og TLS-skrifvillur birtast síðar.
- NVS-commit með `ESP_OK` og `HuginnSettings saved to NVS` birtist um 11:38:32 UTC; AES/TLS-skrifvilla fylgir um 122 ms síðar.
- Sameiginlegt HTTP-beiðniauðkenni, slóð/aferð og birtugildi vantar í tengdu færslurnar. Upptakan bindur hvorki villuna við þá vistun né 10%/80% tilraunirnar. GET-greiningarsamantektin nær ekki yfir POST.

Frásögn eiganda um mjög dimman skjá við 10% er varðveitt sem raunathugun hans. Appið gerði engan nýjan lestur eða breytingu á tækinu; núverandi birtugildi er ekki staðfest hér. **POST-flutningsbilunin er áfram óleyst. Nýja viðmótið lagar hana ekki.** Bilanameðhöndlunin gerir ráð fyrir að skrif geti hafa tekist þótt svarið glatist.

## Prófanir sem voru keyrðar

**105 próf standast, 0 fallin, sleppt eða afturkölluð**, ný samfelld keyrsla gegn endanlegri útgáfu:

```powershell
Set-Location C:/HuginnAPP
node scripts/check-field-save.mjs
```

Ný próf: `tests/field-save-protocol.test.mjs`, `tests/pwa-field-save-browser.test.mjs`, `tests/pwa-field-save-upgrade.test.mjs`. Þau nota fyrirliggjandi C-stillingasamskiptalíkan, tímabundin gögn og einangruð vafrasnið. Þau staðfesta m.a.:

- Einn liður sendir aðeins valinn reit og skilur önnur drög eftir; engin POST við innslátt.
- Ógildur/tómur reitur stöðvar heildarvistun; annar gildur liður má vistast án þess að ógildi textinn tapist.
- Tvísmellur skapar aðeins eina apply-beiðni.
- Báðir takkar með rofnu POST-svari **eftir skrif í host-líkaninu**, með nýrri innslætti meðan svari er haldið: endurlestur staðfestir gamla senda gildið og nýju drögin haldast.
- Báðir takkar með misheppnuðum endurlestri: óvissa lokar skrifum, nýrri innsláttur helst og lestrartakkinn endurtekur ekki apply.
- Hlutastaðfesting merkir aðeins samsvarandi reiti Vistað; hinir sýna svar tækisins og halda drögum.
- Ófullkomið preview-svar sendir ekkert apply. Tengingarrof eftir commit og seint svar þurfa ferskan GET eftir endurtengingu. Útrunnin heimild býður nýja pörun.
- Raunveruleg uppfærsla eldri worker, bilandi candidate, varðveisla IndexedDB/nákvæmra skráa og offline enduropnun.
- Fyrirliggjandi skema/identity/SHA/grunnútgáfuvörn, verndaðir tímar, readback, QR, tengingarlíftími, skráagreining, stærðarmörk, geymsla, merki og táknmyndir.

Prófunarvillur meðan prófunarrammi var undirbúinn eru varðveittar í `build/field-save-review/*tests.log`, `browser-*.log` og `auth-state-harness-failure.log`. Nýja heimildarprófið beið fyrst ranglega eftir `failure`, sem er atburðarheiti; fyrirliggjandi tengingarstaða eftir slíkan atburð er `lost`. Lokaprófið krefst `lost` og sýnilegrar nýrrar pörunar. Production-vörn var ekki breytt til að láta prófið standast.

Gamlar UI-prófanir sem smella á Preview eru ekki taldar standast nýja ferlið. Samskiptavarnir þeirra eru áfram prófaðar. Sögulega **FIRMWARE_HEAD-prófið er áfram fallið**, expected `2b7323b749e517fabab6134f4d4493ec22bc0b3b`, actual `74f45528a8aece434d9af1b757b18bc8caa8fe45`; það var hvorki veikt né talið meðal þessara 105.

Niðurstöður: [focused-tests.log](build/field-save-review/focused-tests.log), SHA256 **93686ec788bf2a87eb155ae8b0937bed8aaa334b11047d707806759ecdb8fdf9**. [Worker/varðveislupróf](build/field-save-review/upgrade/update-results.json). Syntax-athuganir og `git diff --check` standast; Git tilkynnti aðeins fyrirliggjandi línuendingaathugasemdir.

## Útgáfa til yfirferðar

**Build: `3f1a35d5e2fe39bd`**

Fryst mappa: `C:/HuginnAPP/build/field-save-review/candidate-3f1a35d5e2fe39bd`, **32 skrár**. Allar stærðir og SHA256: [final-candidate-review.json](build/field-save-review/final-candidate-review.json). `SHA256(build.json)` = **424e6c7bd5a0edc7906191d4251032a16c473ae443e4e7c34aa185e0cd178993**. Fyrra millistig `4c0979d790952588` er varðveitt en er ekki lokaútgáfan til dreifingar.

Hegðunarbreytingar eru aðeins í `pwa/settings-ui.mjs`, nýjum vistunarhjálpum í `pwa/settings-v2.mjs` og stillingahnappi `pwa/index.html`. Bætar núverandi `createV2SettingsSession`-varða eru óbreyttir; nýi hjálparkóðinn nýtir þá. Entry/worker munur er aðeins build-stimplun. CSS, source/TLS/auth, merki, manifest, táknmyndir, geymslumátar, QR/endurtenging og FLG-fixtures eru bæta-identísk miðað við 9dce699595b724ea. ENGINE/AIRFRAME TIME eru áfram útilokuð úr skrifanlegum reitum og payload. NO-ACK helst false; útflutningur er ekki staðfest Muninn-innflutningur.

Fryst, sannreynt rollback-afrit af 9dce699595b724ea: `build/field-save-review/rollback-final-9dce699595b724ea`. Fyrra deployment **ed68bd11-ba85-45e5-9894-e844e8fe8b09** er ekki breytt eða eytt. Engin dreifing fór fram.

```powershell
Set-Location C:/HuginnAPP
node scripts/prepare-field-save-final.mjs --verify
```

Undirbúin dreifingarskipun, **aðeins eftir nýtt samþykki; ekki keyrð**:

```powershell
Set-Location C:/HuginnAPP
$env:CLOUDFLARE_ACCOUNT_ID = 'afc733ae88054c22d7214b083132bfbc'
$env:WRANGLER_SEND_METRICS = 'false'
node C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js pages deploy C:/HuginnAPP/build/field-save-review/candidate-3f1a35d5e2fe39bd --project-name huginnapp-pwa-test --branch main --commit-dirty=true
```

## Skjámyndir og síðar samþykkispróf á iPhone

390 × 844 vaframyndir með tilbúnum prófunargildum, skoðaðar sjónrænt; ekki iPhone-próf:

- [Óvistað og Vista breytingu](build/field-save-review/screenshots/unsaved.png)
- [Ógilt gildi](build/field-save-review/screenshots/invalid.png)
- [Óviss vistun eins liðar](build/field-save-review/screenshots/uncertain-one.png)
- [Óviss heildarvistun](build/field-save-review/screenshots/uncertain-all.png)
- [Hlutastaðfesting](build/field-save-review/screenshots/partial.png)
- [Staðfestur endurlestur](build/field-save-review/screenshots/verified.png)

**Ekki framkvæma nú. Dreifing og raunveruleg tækjaskrif bíða samþykkis eiganda.** Tillaga að stuttu samþykkisferli eftir það:

1. Á nettengdu neti: uppfæra núverandi uppsetta PWA með venjulegu **Uppfæra HuginnAPP**, með aðra glugga lokaða og engar aðgerðir í gangi. Staðfesta build, active/controlling worker og raunverulegu hnappana í nýja viðmótinu. Ekki hreinsa gögn eða setja upp aftur.
2. Hefja fyrirliggjandi óendurstillandi COM5-upptöku eftir venjulega ræsingu/REC WAIT; bíða eftir **ARMED áður en símaaðgerðir hefjast**. Ekki ýta á RESET meðan upptaka er opin.
3. Tengjast með fyrirliggjandi pörun, hafa MAIN sýnilegt og sækja núverandi stillingar. Skrá raunverulegt upphafsgildi; ekki ganga út frá 95, 10 eða 80. Prófa innslátt og Óvistað án blur.
4. Aðeins með heimild til tækjaskrifa: eigandi velur eina afturkræfa breytingu og annað ósent drag. Vista fyrri liðinn einu sinni og krefjast staðfests endurlesturs; hitt dragið á að haldast. Prófa heildarvistun aðeins með samþykktum gildum. Ekki endurtaka skrif ef niðurstaða er óviss; nota Lesa stöðu aftur.
5. Varðveita símaniðurstöðu (operation, HTTP status, declared/received bytes, phase/code), stöðu reita og nákvæma stöðvaða capture-möppu. Lestrarskipun þarf **`-CaptureFolder` með þeirri raunverulegu slóð þegar hún er þekkt**. Endurheimt upphafsgildis þarf sér samþykkta, staðfesta vistun; stöðva skrif ef óvissa er um síðast staðfesta gildi.

Engin endurtekin áreiðanleiki, vistun yfir endurræsingu, iPhone-uppfærsla eða lausn á POST-flutningsbilun er staðfest með þessum host-/vafraprófum.
