# HuginnEIS Rev. 2.9 — frátekinn S3 output-bounce búffer

Til yfirferðar. Build og offline VERIFY stóðust. **Ekki flashað, ekkert COM-port opnað, engin ný tækjaprófun eða stillingavistun. COM10 var ekki snert.** HuginnAPP a2acd940a7370142 var ekki breytt; QR-endurheimt þess er eigandastaðfest og utan þessa verks.

## Gögn og orsakamörk

Öll Rev. 2.8 hráupptakan console-20261108T191256Z var áður lesin og SHA-256 var endursannreynt hér: 433183861e27be6824e18cfbc5eda7ff52c439420e45fc819ed7822f1b8181d2.

GET 10/11: 512 bæta bounce_output/MALLOC_CAP_DMA úthlutun mistókst; TLS tók 4096/29503 bæti. DMA free/largest var 2003/320 og 1723/304. Þetta staðfestir ónóga samfellda gjaldgenga blokk, ekki hvaða fyrri úthlutanir eða hugsanlegur leki orsökuðu stöðuna. GET 12–15 kláruðust á tækinu. Eigandastaðfest ein heppnuð óvaranleg POST-prófun er aðskilin niðurstaða og sannar ekki endurtekna áreiðanleika.

## Afmarkaður kóði og eignarhald

Eina hegðunarbreytingin er í project-local components/mbedtls/port/aes/dma/esp_aes_dma_core.c: núverandi S3 output-only-bounce leið notar einn frátekinn 512 bæta DMA_ATTR búffer, 16-jafnaðan, í stað heap-úthlutunar. Bútastærðin helst 512, margfeldi 16 bæta AES-blokkar. Input-bounce, aðrir targets og stærri descriptor-keðjur halda fyrri leiðum. 24 bæta descriptor-par Rev. 2.8 er áfram notað.

- Allir framleiðslukallarar þessarar leiðar í dma/esp_aes.c taka esp_aes_acquire_hardware fyrir DMA og losa eftir niðurstöðu/stream-state meðhöndlun. Á S3 er þetta AES/SHA-lásinn. Innri endurkvæmt bounce-kall endurtekur ekki lásatöku og getur ekki valið sama output-bounce aftur: nýi output-búfferinn er innri og jafnaður.
- Lásinn nær yfir fyrsta búfferafnot, allar DMA-aðgerðir, bið, síðustu memcpy og zeroize. Við villu eftir DMA-start framkvæmir núverandi innri cleanup esp_crypto_shared_gdma_abort (stop/reset beggja rása) og transform finish áður en ytri cleanup þurrkar frátekna búfferinn og kallari losar lásinn.
- Aðeins heap-owned output er free-að. Frátekin geymsla er í gagnkvæmt útilokandi else-grein og er zeroize-uð á árangurs-/villuleið áður en næsti eigandi getur fengið lásinn. Enginn samanburður við heap-bendil eftir free á þeirri grein.
- Enginn retry, TLS/auth/config-breyting eða samþykki á ófullkomnu svari. Fyrirliggjandi HTTP-send- og úthlutunargreining er áfram tengd. Heap-probe á bounce_output á ekki við um frátekna leið þar sem engin slík heap-úthlutun fer fram; önnur heap-föll halda greiningunni.

CMakeLists.txt og main/main.c breytast aðeins í sýnilega revision/PROJECT_VER **HuginnEIS Rev. 2.9**. Upptöku-, CAN-, CHT-, viðmóts- og stillingakóði er óbreyttur utan revision-strengsins. Shared ESP-IDF 5.5.2 er hash-sannreynt óbreytt.

Diff: C:/HuginnAPP/protocol/rev29-reserved-output-and-version.patch.

## Mæld minnisáhrif og takmörk

| ELF-atriði | Rev. 2.8 | Rev. 2.9 | Munur |
|---|---:|---:|---:|
| .dram0.data | 37332 | 37852 | +520 bæti |
| .dram0.bss | 64272 | 64272 | 0 |
| .iram0.text | 133427 | 133427 | 0 |

Scratch er 0x3fcab9d0, 512 bæti, 16-jafnað og innan raunverulegs .dram0.data hluta ELF og SOC_DMA_LOW/HIGH. Descriptor-par er 0x3fcab998, 24 bæti, 8-jafnað. _heap_start færist um 520 bæti: 512 bæta reserve auk 8 bæta jöfnunarkostnaðar í þessari smíði. Enginn allocator-header eða per-request scratch-allocation-kostnaður fylgir frátekinni geymslu.

Þessi kostnaður er varanlegur og skerðir mögulegt innra heap milli sendinga. Ekki má fullyrða að fyrri free/largest mælingar verði einfaldlega lægri um 520; boot-úthlutunarskipan getur breyst. Wi-Fi heldur 10 static RX / 32 dynamic RX / 32 dynamic TX og 32768 bæta internal reserve stillingu. Engin Wi-Fi-mörk eru hækkuð eða lækkuð.

Recorder stack er áfram 4096 bæti og TCB 340 bæti, á sömu stöðum og áður, en þetta tryggir ekki allt upptökusvigrúm: appið notar SDSPI; SD/SPI driver-leiðir geta þurft tímabundna MALLOC_CAP_DMA búffera, þar á meðal sector-stærð þegar buffer alignment krefst þess. Nýi AES-reserve leysir ekki þær mögulegu úthlutanir. Raunverulegt Wi-Fi-/SD-/CAN-álag og flugupptaka voru ekki prófuð. Engin ályktun er dregin um sögulegt REC FAIL.

## Prófanir og bygging

- Raunverulegt breytt bounce-fall er dregið úr framleiðslusource; S3 DMA-routing/cleanup er úr varðveittu Rev. 2.8 falli sem er óbreytt í þessum diff. OpenSSL og heap/DMA-seams koma í stað peripheral á hosti. GCC -Wall -Wextra -Werror, AddressSanitizer og UndefinedBehaviorSanitizer stóðust.
- Rev. 2.8 heap-úthlutun endursköpuð sem bilun við 2003/320 og 1723/304; ný leið tekst án scratch/stuttrar descriptor-heap-úthlutunar. Viðbótarpróf skuldfærir mæld 520 bæti og 0/128/256 bæta hermda samkeppni. Þetta eru tilbúnar blokkaskipanir með mældum mörkum, ekki endurgerð raunverulegs heaps.
- AES-128/256 CBC/CTR/GCM ciphertext/decrypt/tag samanburður, in-place/out-of-place, lokabrot og 16/512/4096/29503 mörk stóðust. 200 heilar response-sequences og 200 heil-body köll frá fjórum samtímaköllurum undir sama lás stóðust. Scratch er þurrkað eftir hverja aðgerð.
- Input/output/descriptor úthlutunarvillur á áfram heap-owned leiðum, DMA-start og biðarvillur á öllum átta bútastöðum, ISR/cache-bilanir og abort-fyrir-endurnotkun voru prófuð. Villur berast áfram án retry.
- Xtensa -fsyntax-only -Wall -Wextra -Werror stóðst fyrir core, layout/caps probe og shared-GDMA cleanup. Engar warning-varnir voru felldar niður. Fyrirliggjandi unrelated unused-function/-variable warnings í heildarbuild voru látin standa.
- Fersk ESP-IDF 5.5.2 smíði og **offline VERIFY stóðust**: exact source/component/toolchain pins frá því fyrir compilation, staðbundnir diagnostics-hlutir raunverulega compiled/linked, scratch/pair ELF staðsetning, revision, ESP32-S3, óbreytt effective SDK config, AppOrigin https://huginnapp-pwa-test.pages.dev, hash, stærð og app-only partition mörk 0x20000 / 0x400000. Þetta er ekki fersk athugun á COM5 eða live partition readback.

Gögn: C:/HuginnAPP/build/rev29-review/{host-tests.log,memory-margin-tests.log,syntax-checks.json,owner-verify.log,review.json}. 7514 varðveittar skrár voru hash-sannreyndar, þar á meðal fyrri Rev. 2.8 build og kvittanir.

Fyrsta smíðin stóðst en var leyst af hólmi við lokaeignarhaldsrýni. Hún er óbreytt í build-rev2.9-20261108; source/test/tool-afrit hennar eru í build/rev29-review/initial og undirbúningur í REV2.9-PREPARATION. **Ekki nota þá mynd.** Endanlega review2 smíðin hér að neðan hefur sérstaka undirbúningskvittun REV2.9-PREPARATION-REVIEW2. Upphafleg build-ræsing stöðvaðist vegna PowerShell execution policy áður en compilation hófst; established per-process Bypass var síðan notað, án breytingar á machine-policy. Upphaflegt host-test vænti enn eldri 1024-byte baseline-bilunar; vænting var leiðrétt að raunverulegri Rev. 2.8 baseline áður en lokapróf stóðust.

## Nákvæm endanleg mynd til yfirferðar

- Mappa: C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.9-20261108-review2
- Mynd: lvgl_porting.bin
- Stærð: **1962544 bæti**
- SHA-256: **5a973ceee832984c6ffe05cf78c741fe7d64c78e84e6494d8e5eeffee40b405e**
- Uppsett COM5 er áfram síðast eigandastaðfest Rev. 2.8. Engin uppsetning er framkvæmd eða fullyrt hér.

Endursannprófun án build eða COM-aðgerðar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.9-OWNER-VERIFY.ps1
```

Smíða skal ekki aftur þessa staðfestu mynd að óþörfu. Ef ný build-tilraun er síðar nauðsynleg skal nota ferskt -BuildDir (t.d. build-rev2.9-20261108-review2-retry1), ekki clean/reuse eða yfirskrifa gögn. Núverandi heimild nær ekki til flash eða keyrslu capture-skrifta.

## Tillaga að næsta COM5-prófi — bíður samþykkis

1. Aðeins eftir sérstakt samþykki: app-only uppsetning nákvæmrar review2 myndar með fyrirliggjandi backup/partition/readback-vörnum. Staðfesta eðlilega ræsingu, Rev. 2.9 og REC WAIT; engin upptaka ræst til prófunar.
2. Ræsa einn REV2.9-OWNER-CAPTURE.ps1 eftir boot og bíða eftir **ARMED áður en símaaðgerðir hefjast**. Enginn annar serial reader; enginn RESET meðan capture er opin. Sama capture helst opin gegnum alla lotuna.
3. Með a2acd940a7370142 í App/Active/Controlling worker: para/tengja og hafa MAIN sýnilegt. Keyra **tvo** read-only Settings diagnostics, einn í einu, bíða eftir lokum hvers.
4. Framkvæma endurtengingarferlið sem á undan biluninni var: skipta frá HuginnEIS Wi-Fi á Anunnaki, setja app í bakgrunn/forgrunn, leyfa einni Reconnect tilraun að mistakast; fara aftur á HuginnEIS Wi-Fi. Reyna venjulega Reconnect einu sinni. Ef ný QR þarf, nota Para aftur með QR án þess að loka appinu. Skrá hvaða leið var notuð. Eftir endurheimt keyra **fjóra** read-only Settings diagnostics.
5. Endurtaka eina bakgrunns-/Wi-Fi-/endurtengingarlotu með sama capture og síðan **fjóra** read-only Settings diagnostics. Samtals **10 heilir, schema-gildir Settings GET** þurfa að standast. Enginn POST-preview eða Vista-hnappur í þessu þrepi. Við fyrstu Settings-flutnings-/úthlutunarvillu skal stöðva GET-lotuna og varðveita hana, ekki halda áfram til að fela bilun.
6. Varðveita símaniðurstöður 1–10 með HTTP status, declaredBytes, receivedBytes, outcome og phase ásamt tímasetningum reconnect/QR. Hver lestur þarf HTTP 200, valid/complete og receivedBytes=declaredBytes; engin föst 29503 bæta forsenda. Skráalistasvar er aðskilið. Eitt heppnað svar nægir ekki.
7. Stöðva capture eðlilega. Þegar raunverulega mappan er þekkt skal lesa hana með skylduargumentinu -CaptureFolder; hér er owner-only snið, ekki keyrt:

```powershell
$captureFolder = Read-Host 'Nákvæm slóð stöðvaðrar capture-möppu'
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.9-OWNER-READ-DIAGNOSTIC.ps1 -CaptureFolder $captureFolder
```

Samþykki krefst matching phone GETs og send-ID í fullri hráupptöku: HTTP result=0, tls_body_accepted=serialized, engar AES/DMA-allocation villur eða tapaðar greiningarfærslur fyrir lestrana, og engar nýjar Wi-Fi/SD/upptökuvillur í upptökunni. Tóm allocation-samantekt ein sér nægir ekki. Lágt DMA-headroom og nýjar villur utan AES þarf að fara yfir sérstaklega. Þetta endurgerir reconnect-aðstæður en tryggir ekki sama heap-layout eða CAN/flugálag.

Stöðva eftir GET-lotuna til sameiginlegrar yfirferðar. Óvaranleg POST-staðfesting og öll raunveruleg vistun bíða frekara samþykkis. Engin flugútgáfa er samþykkt með þessu prófi.
