import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('pwa/entry.mjs','utf8');
s=s.replace("feedback(code.startsWith('PAIR_')?'Ekki tókst að para við HuginnEIS. Reyndu að skanna aftur.':text,code);el('source-scan').textContent='Reyna að skanna aftur';", "feedback(code.startsWith('PAIR_')?t('QR-kóðinn er ógildur eða ekki studdur. Skannaðu aftur.','The pairing QR is invalid or unsupported. Scan again.'):t(text,'Could not read the QR code. Check camera permission and scan again.'),code);el('source-scan').textContent=t('Skanna aftur','Scan again');");
s=s.replace("feedback('Skönnun hætt.');", "feedback(t('Skönnun hætt.','Scanning canceled.'));");
await writeFile('pwa/entry.mjs',s);
