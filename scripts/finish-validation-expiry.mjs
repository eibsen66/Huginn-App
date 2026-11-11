import {readFile,writeFile} from 'node:fs/promises';
const p='pwa/settings-ui.mjs';let s=await readFile(p,'utf8');
s=s.replace("validation.state==='error'?'error':verified?","validation.state==='expired'?'expired':validation.state==='error'?'error':verified?");
s=s.replace("checking:t('Athuga breytingar", "expired:t('Athugun er útrunnin. Breyttu reit til að athuga aftur; ekkert vistað.','Validation expired. Edit a field to check again; nothing saved.'),checking:t('Athuga breytingar");
await writeFile(p,s);
