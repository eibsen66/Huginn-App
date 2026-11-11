import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',build=root+'/build-rev2.10-20261109-retry1',out='C:/HuginnAPP/build/rev210-review',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p));
const before=await json(out+'/before.json'),preserved=await json('C:/HuginnEIS/Tools/rev210-preserved-inputs.json');
for(const [p,h]of Object.entries(preserved))assert.equal(sha(await readFile(p)),h,'Preserved input '+p);
for(const p of ['main/main.c','CMakeLists.txt'])assert.equal((await readFile(root+'/'+p,'utf8')).replaceAll('HuginnEIS Rev. 2.10','HuginnEIS Rev. 2.9'),await readFile(out+'/'+p.replaceAll('/','__')+'.before','utf8'),'Only revision may change '+p);
let patch='';for(const p of before.paths){try{execFileSync('git',['-c','core.autocrlf=false','diff','--no-index','--ignore-cr-at-eol','--',out+'/'+p.replaceAll('/','__')+'.before',root+'/'+p],{encoding:'utf8',windowsHide:true});}catch(e){if(e.status!==1)throw e;patch+=e.stdout.replaceAll('a/'+out+'/'+p.replaceAll('/','__')+'.before','a/'+p).replaceAll('b/'+root+'/'+p,'b/'+p);}}
await writeFile('C:/HuginnAPP/protocol/rev210-get-admission-reasons.patch',patch);
const complete=await json(build+'/owner-build-complete.json'),result=await json(build+'/owner-build-result.json');assert.equal(result.successful,true);for(const [p,h]of Object.entries(complete.outputs))assert.equal(sha(await readFile(build+'/'+p)),h,'Build output '+p);
const binary=await readFile(build+'/lvgl_porting.bin'),evidence={};for(const p of ['host-tests.log','http-selection-tests.log','save-regression.log','admission-host.c','job-layout.c','owner-verify.log'])evidence[p]=sha(await readFile(out+'/'+p));
const oldCore=JSON.parse(await readFile('C:/HuginnEIS/Tools/rev29-diagnostic-inputs.json')),newCore=JSON.parse(await readFile('C:/HuginnEIS/Tools/rev210-diagnostic-inputs.json'));assert.deepEqual(newCore,oldCore,'TLS/AES diagnostic components unchanged');
const sizeTool='C:/Espressif/tools/xtensa-esp-elf/esp-14.2.0_20251107/xtensa-esp-elf/bin/xtensa-esp32s3-elf-size.exe';
const sections=dir=>Object.fromEntries([...execFileSync(sizeTool,['-A',dir+'/lvgl_porting.elf'],{encoding:'utf8',windowsHide:true}).matchAll(/^(\.[\w.]+)\s+(\d+)\s+\d+$/gm)].map(m=>[m[1],Number(m[2])]));
const oldSections=sections(root+'/build-rev2.9-20261108-review2'),newSections=sections(build);for(const p of ['.dram0.data','.dram0.bss','.iram0.text'])assert.equal(newSections[p],oldSections[p],'Static memory changed '+p);
const r={revision:'HuginnEIS Rev. 2.10',build,bytes:binary.length,sha256:sha(binary),patch_sha256:sha(Buffer.from(patch)),evidence,retained_files_verified:Object.keys(preserved).length,diagnostic_components_unchanged:true,job_size_unchanged_host_and_xtensa:true,no_com_access:true,physical_validation:false};await writeFile(out+'/review.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));
const text=`# HuginnEIS Rev. 2.10 — Settings GET höfnunarástæða

Til yfirferðar. Ferskt build og offline VERIFY stóðust; **ekki flashað, engin COM-aðgerð eða tækjaprófun framkvæmd**. Uppsett COM5 er síðast eigandastaðfest Rev. 2.9. COM10 og HuginnAPP eru óbreytt.

## Breyting og rétt matsröð

Í main/huginn_settings_v2.inc er sama aðgangsmat tekið í hs2_admission í þessari röð: modal → live_unavailable → persistence_inhibited → snapshot. Fallið skilar við fyrstu höfnun; ekkert síðara skilyrði er metið. Fyrirliggjandi base/candidate úthlutanir og auth/cancellation mat eru áfram á undan þessu mati.

Snapshot greinir snapshot_alloc_failed beint þegar fyrirliggjandi PSRAM-úthlutun bregst og snapshot_baseline_missing beint þegar committed-snapshot-copy skilar false. Engin endurathugun eða ný heap-úthlutun er framkvæmd. Ástæða er einn uint8_t reitur í fyrirliggjandi job-hlutnum; host- og Xtensa-static-assert staðfesta **óbreytt sizeof(Hs2Job)**. Apply-readback kallar sama snapshot-fall með NULL diagnostic destination og heldur fyrri merkingu.

Ástæðan ferðast með job að HTTP-handler. Aðeins þegar handler velur 409 svar fyrir GET með þekkta höfnunarástæðu kemur ein lína:

    HS2_ADMISSION: GET denied reason=modal

Leyfð nöfn eru aðeins modal, live_unavailable, persistence_inhibited, snapshot_alloc_failed og snapshot_baseline_missing. Engin stillingagildi, tokens, auðkennisupplýsingar eða request-body eru skráð. Errno er varðveitt yfir logger-kallið. Ef request-heimild er afturkölluð áður en svarið er valið eða serialization skilar 500, er þessi 409-greining ekki skráð. Heppnaður GET og POST-aðgerðir fá enga slíka færslu. Línan lýsir völdu höfnunarsvari, ekki sönnun um móttöku þess í símanum.

HTTP 409 og JSON-svarið SETTINGS_BUSY_OR_UNAVAILABLE haldast óbreytt. GET-send/alloc samantektin nær áfram aðeins yfir settings-document með fields; nýja línan er í **hráupptöku**, ekki nýr liður í þeirri samantekt.

TLS/DMA/512-byte reserved scratch og descriptor-par eru óbreytt, ásamt preview/apply/readback, vernduðum tímum, eldsneyti, CAN, upptöku, CHT og viðmóti. Aðeins revision-strengir í CMakeLists.txt og main/main.c fara í HuginnEIS Rev. 2.10.

ELF samanburður við Rev. 2.9 staðfestir óbreytt .dram0.data (${newSections['.dram0.data']} bæti), .dram0.bss (${newSections['.dram0.bss']}) og .iram0.text (${newSections['.iram0.text']}). Hvorki föst SRAM-geymsla né job-allocation stærð vex vegna þessarar greiningar.

Diff: C:/HuginnAPP/protocol/rev210-get-admission-reasons.patch.

## Prófanir sem voru raunverulega keyrðar

- Actual extracted snapshot/admission/name/logging functions: allar fimm greinar, hver með síðari greinar líka settar í bilun, staðfest matsröð/short-circuit, nákvæm allowlist, ein GET-lína, engin POST-/success-lína, óbreytt errno og NULL apply-readback destination. GCC -Wall -Wextra -Werror, ASan og UBSan stóðust.
- Tvö sjálfstæð full protocol host-líkön með gamla og nýja owner-kóðanum: heppnaður GET og modal-denial JSON eru bæti fyrir bæti eins; protected/fuel/fault/recording sentinels haldast.
- Actual HTTP status-selection grein með hermdum request/JSON/logger seams: allar fimm GET-höfnunarástæður halda HTTP 409 og skrá einu sinni; POST og ótengd villa skrá ekki þessa línu; heppnaður GET heldur 200 án höfnunarfærslu. ASan/UBSan og -Wall -Wextra -Werror stóðust.
- Viðbótar host-lotur með raunverulega V2 clientnum: GET → preview → hermd apply → authoritative readback gaf nákvæmlega sömu svör fyrir og eftir breytingu. Engin raunveruleg skrif voru gerð.
- Xtensa -std=c11 -Wall -Wextra -Werror -fsyntax-only staðfesti að ástæðureiturinn stækkar ekki job-úthlutunina. Fulla framleiðslu-include var síðan raunverulega compiled/linked í ferska firmware-buildinu.
- Offline VERIFY staðfesti source/config/toolchain pins frá því fyrir compilation, ESP-IDF 5.5.2, ESP32-S3, nýja revision, öll fimm reason-strengi og log-format í myndinni, óbreytta staðbundna TLS/AES-hluta, reserved scratch/pair ELF staðsetningu, AppOrigin https://huginnapp-pwa-test.pages.dev, stærð/hash og app-only mörk 0x20000 / OTA0 0x400000. Þetta er ekki ný live-COM5 partition/identity athugun.

Upphafleg context-check stöðvaðist vegna CRLF áður en source var skrifað; before-images haldast í rev210-review-context-attempt. Host fixture vantaði upphaflega fyrirliggjandi diagnostic-header; báðum samanburðarlíkönum var gefinn sami host-header. Undirbúningsathugun stöðvaðist einnig rétt við gamla immutable pin á nú sérstaklega heimilaða include-breytingu; ný kvittun sannreynir varðveitta before-image í stað þess að kalla breytta source óbreytt. Engin vörn var felld niður.

Fyrsta target-build stöðvaðist í óbreyttum SDK esp_lcd_panel_rgb.c:700, rgb_panel_draw_bitmap, með internal compiler error: Segmentation fault during RTL pass ira. Allt build-rev2.10-20261109 og unsuccessful kvittun haldast. Endanleg retry1 smíði notar nákvæmlega sömu source/config/toolchain-pinna og flögg, í ferskri möppu; engin SDK-breyting eða warning-suppression var gerð vegna hrunsins.

Sögulega FIRMWARE_HEAD-bilunin er áfram óbreytt, ekki endurkeyrð og ekki talin staðin. Engar compiler-varnir voru veiktar; unrelated eldri build-warnings voru látnar standa.

## Mynd og gögn til yfirferðar

- Build: ${build}
- App: lvgl_porting.bin, **${r.bytes} bæti**
- SHA-256: **${r.sha256}**
- Undirbúningur: C:/HuginnEIS/Evidence/REV2.10-PREPARATION
- Prófgögn: C:/HuginnAPP/build/rev210-review/host-tests.log og save-regression.log
- Kvittun: C:/HuginnAPP/build/rev210-review/review.json
- ${r.retained_files_verified} eldri skrár hash-sannreyndar, þar á meðal Rev. 2.9 mynd/build/config/kvittanir og console-20261109T184048Z.

Endursannprófun án build eða COM-aðgerðar:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.10-OWNER-VERIFY.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.10-20261109-retry1
~~~

Smíða ekki aftur þessa mynd að óþörfu. Ef ný build-tilraun þarf síðar að fara fram: nota ferskt -BuildDir, t.d. build-rev2.10-20261109-retry1, varðveita kvittanir og ekki clean/reuse.

Flash og ný tækjaprófun bíða samþykkis Egils. Eftir slíkt samþykki þarf capture ARMED áður en GET er gert. Við næstu 409 nægir ein HS2_ADMISSION-lína samhliða fullu 51-byte símasvari til að auðkenna fyrstu höfnunargreinina. Engin þörf er á að breyta aðgangsskilyrðum eða prófa POST/vistun fyrir þá greiningu. Aðgreina áfram 409-höfnun, fullar DMA-sendingar og endurtengingar; engin endurtekin tækjaprófun hefur verið framkvæmd hér.
`;
await writeFile('REV2.10-GET-ADMISSION-REVIEW.md',text);await writeFile('C:/HuginnEIS/REV2.10-OWNER-HANDOFF.md',text,{flag:'wx'});
