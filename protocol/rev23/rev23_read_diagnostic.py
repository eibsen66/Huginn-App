"""Read saved COM5 capture files only. Prints numeric Settings-send records."""
import argparse,hashlib,json,re
from pathlib import Path
BASE=Path('C:/HuginnEIS/Evidence/REV2.3-COM5')
FIELDS={'id','bytes','tls_body_accepted','http_result','http_errno','raw_tls','tls_errno','tls_requested','https_return','https_errno','https_requested','calls','elapsed_us'}
def records(text):
    result=[]
    for line in text.splitlines():
        found=re.search(r'HS2_SEND:\s*(begin|end)\b(.*)',line)
        if not found:continue
        values={k:int(v) for k,v in re.findall(r'\b([a-z_]+)=(-?\d+)\b',found[2]) if k in FIELDS}
        if 'id' in values:result.append({'event':found[1],**values})
    return result
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--folder');a=p.parse_args()
    choices=sorted(BASE.glob('console-*'))
    folder=Path(a.folder).resolve() if a.folder else (choices[-1].resolve() if choices else None)
    if folder is None or folder.parent!=BASE.resolve() or not folder.name.startswith('console-'):raise ValueError('No saved Rev. 2.3 COM5 capture')
    status=json.loads((folder/'status.json').read_text())
    if not str(status.get('status','')).startswith('STOPPED'):raise ValueError('Stop capture with Ctrl+C first; do not reset')
    raw=(folder/'console.raw').read_bytes();found=records(raw.decode('utf8',errors='replace'))
    result={'capture':folder.as_posix(),'capture_status':status['status'],'raw_sha256':hashlib.sha256(raw).hexdigest(),
            'settings_send_records':found,'physical_cause_proven':False,
            'meaning':'tls_body_accepted is plaintext accepted by mbedtls_ssl_write, not phone receipt/ACK'}
    dest=folder/'settings-send-summary.json';encoded=json.dumps(result,indent=2)+'\n'
    if dest.exists():
        if dest.read_text()!=encoded:raise ValueError('Saved summary differs; preserve both and review')
    else:
        with dest.open('x',encoding='utf8') as f:f.write(encoded)
    print(encoded)
if __name__=='__main__':main()
