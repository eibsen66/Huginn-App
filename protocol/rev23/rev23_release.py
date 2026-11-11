"""Rev. 2.3 owner provenance and offline verification; only 'flash' opens COM5."""
import argparse, hashlib, importlib.util, json, re, shlex, shutil, subprocess, sys, time
from pathlib import Path
ROOT=Path('C:/HuginnEIS/Huginn/Firmware/huginn')
DEFAULT=ROOT/'build-rev2.3-20261104'
EVIDENCE=Path('C:/HuginnEIS/Evidence/REV2.3-PREPARATION')
SDK=Path('C:/esp/v5.5.2/esp-idf')
SEED=ROOT/'build-rev2.2-20261102/sdkconfig'
SAVED=Path('C:/HuginnEIS/Evidence/COM5-20261101/flash-readback.private.bin')
ORIGIN='https://huginnapp-pwa-test.pages.dev'
VERSION='HuginnEIS Rev. 2.3'
spec=importlib.util.spec_from_file_location('rev22_base',Path(__file__).with_name('rev22_release.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.VERSION=VERSION
need=base.require;digest=base.digest;load=base.load
OUTPUTS=base.OUTPUTS+('lvgl_porting.map','config/sdkconfig.h')
def save(p,value):
    with p.open('x',encoding='utf8') as f: json.dump(value,f,indent=2)
def run(command):
    return subprocess.run([str(p) for p in command],check=True,capture_output=True,text=True).stdout.strip()
def tree(root):
    return {p.relative_to(root).as_posix():digest(p) for p in sorted(root.rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
def toolchain():
    paths={'python':Path(sys.executable),'idf':SDK/'tools/idf.py',
       'compiler':Path('C:/Espressif/tools/xtensa-esp-elf/esp-14.2.0_20251107/xtensa-esp-elf/bin/xtensa-esp32s3-elf-gcc.exe'),
       'nm':Path('C:/Espressif/tools/xtensa-esp-elf/esp-14.2.0_20251107/xtensa-esp-elf/bin/xtensa-esp32s3-elf-nm.exe'),
       'cmake':Path('C:/Espressif/tools/cmake/3.30.2/bin/cmake.exe'),
       'ninja':Path('C:/Espressif/tools/ninja/1.12.1/ninja.exe')}
    result={}
    for name,p in paths.items():
        command=[sys.executable,p,'--version'] if name=='idf' else [p,'--version']
        result[name]={'path':p.as_posix(),'sha256':digest(p),'version':run(command)}
    need(result['idf']['version'].startswith('ESP-IDF v5.5.2'),'Wrong IDF version')
    need('14.2.0' in result['compiler']['version'],'Wrong compiler version')
    return result
def diagnostic_inputs():
    expected=load(Path(__file__).with_name('rev23-diagnostic-inputs.json'))
    for name in ('esp-tls','esp_https_server'):
        need(tree(SDK/'components'/name)==expected['original'][name],'Shared SDK changed: '+name)
        need(tree(ROOT/'components'/name)==expected['local'][name],'Local diagnostic component changed: '+name)
    return expected
def config_values(text):
    result={}
    for line in text.splitlines():
        if line.startswith('CONFIG_') and '=' in line:
            k,v=line.split('=',1);result[k]=v
        elif re.fullmatch(r'# CONFIG_[A-Z0-9_]+ is not set',line):result[line.split()[1]]='n'
    return result
def scripts():
    paths=[Path(__file__),Path(__file__).with_name('rev22_release.py'),Path(__file__).with_name('rev23-diagnostic-inputs.json')]
    paths+=list(Path('C:/HuginnEIS').glob('REV2.3-OWNER-*.ps1'))
    paths.append(Path(__file__).with_name('rev23_capture.py'))
    return {p.as_posix():digest(p) for p in sorted(paths)}
def prepare():
    need(not EVIDENCE.exists(),'Preparation evidence already exists; preserve it')
    diagnostic_inputs();base.check_config(SEED.read_text())
    need('set(PROJECT_VER "'+VERSION+'")' in (ROOT/'CMakeLists.txt').read_text(),'Wrong source revision')
    need('#define HUGINN_BUILD_ID "'+VERSION+'"' in (ROOT/'main/main.c').read_text(),'Wrong UI revision')
    EVIDENCE.mkdir(parents=True)
    save(EVIDENCE/'prepared.json',{'created_epoch':time.time(),'origin':ORIGIN,'revision':VERSION,
        'sources':base.source_pins(ROOT),'diagnostics':diagnostic_inputs(),'toolchain':toolchain(),
        'seed_sha256':digest(SEED),'saved_flash_sha256':digest(SAVED),'scripts':scripts()})
    print('Prepared current Rev. 2.3 source/SDK/toolchain attestation; no compilation')
def prepared():
    p=load(EVIDENCE/'prepared.json');need(p['revision']==VERSION and p['origin']==ORIGIN,'Wrong preparation')
    need(base.source_pins(ROOT)==p['sources'],'Source changed since preparation; review and attest separately')
    need(diagnostic_inputs()==p['diagnostics'],'Diagnostic inputs changed')
    need(toolchain()==p['toolchain'],'Toolchain changed')
    need(scripts()==p['scripts'],'Owner script changed since preparation')
    need(digest(SEED)==p['seed_sha256'] and digest(SAVED)==p['saved_flash_sha256'],'Preserved Rev. 2.2/reference changed')
    return p
def build_path(value):
    p=Path(value).resolve()
    need(p.parent==ROOT.resolve() and re.fullmatch(r'build-rev2\.3-[A-Za-z0-9.-]+',p.name),'Build directory must be a fresh named Rev. 2.3 child')
    return p
def start(build):
    p=prepared();need(not build.exists(),'Preserve existing build/logs; use a fresh -BuildDir for explicit retry')
    build.mkdir();shutil.copyfile(SEED,build/'sdkconfig')
    save(build/'owner-build-start.json',{'started_epoch':time.time(),'prepared_sha256':digest(EVIDENCE/'prepared.json'),
        'origin':ORIGIN,'revision':VERSION,'sources':p['sources'],'toolchain':p['toolchain'],
        'diagnostics':p['diagnostics'],'scripts':p['scripts'],'saved_flash_sha256':p['saved_flash_sha256'],
        'seed_sha256':p['seed_sha256'],'build':build.as_posix()})
    print('Pinned fresh build inputs BEFORE compilation: '+build.as_posix())
def owner_build(build):
    start(build)
    command=[sys.executable,str(SDK/'tools/idf.py'),'-B',str(build),'-DSDKCONFIG='+str(build/'sdkconfig'),
        '-DIDF_TARGET=esp32s3','-DHUGINN_TARGET_PROFILE=DEV_HFS2_7PART',
        *['-D'+name+'=OFF' for name in base.OFF],'-DHUGINN_COURIER_QR=ON',
        '-DHUGINN_COURIER_DEV_ORIGIN='+ORIGIN,'build']
    save(build/'owner-command.json',{'command':command,'started_epoch':time.time()})
    code=1
    try:
        with (build/'owner-build-console.log').open('xb',buffering=0) as log:
            process=subprocess.Popen(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            try:
                for chunk in iter(lambda:process.stdout.read(8192),b''):
                    log.write(chunk);sys.stdout.buffer.write(chunk);sys.stdout.buffer.flush()
                code=process.wait()
            finally:
                if process.poll() is None:
                    process.terminate();process.wait()
    finally:
        finish(build,code)
def check_start(build):
    p=prepared();s=load(build/'owner-build-start.json')
    need(s['prepared_sha256']==digest(EVIDENCE/'prepared.json'),'Preparation receipt changed')
    need(s['build']==build.as_posix() and s['sources']==p['sources'] and s['toolchain']==p['toolchain'] and s['diagnostics']==p['diagnostics'] and s['origin']==ORIGIN,'Start provenance mismatch')
    return s
def diagnostic_selection(desc,commands):
    for name,files in {'esp-tls':['esp_tls_mbedtls.c','huginn_settings_send_diag.c'],'esp_https_server':['src/https_server.c']}.items():
        need(Path(desc['build_component_info'][name]['dir']).resolve()==(ROOT/'components'/name).resolve(),'Instrumented component not selected '+name)
        for f in files:
            path=(ROOT/'components'/name/f).resolve();matches=[c for c in commands if Path(c['file']).resolve()==path]
            need(len(matches)==1,'Diagnostic source missing/duplicate '+f)
            need(str(path).replace('\\','/').lower() in matches[0].get('command',' '.join(matches[0].get('arguments',[]))).replace('\\','/').lower(),'Compiler command does not use local source')
    need(not any(Path(c['file']).resolve() in [(SDK/'components/esp-tls/esp_tls_mbedtls.c').resolve(),(SDK/'components/esp_https_server/src/https_server.c').resolve()] for c in commands),'Shared uninstrumented source compiled')
def effective(build):
    need(config_values((build/'sdkconfig').read_text())==config_values(SEED.read_text()),'Effective SDK configuration differs from Rev. 2.2 seed')
    base.check_config((build/'sdkconfig').read_text())
    cache=(build/'CMakeCache.txt').read_text()
    for name,value in [(n,'OFF') for n in base.OFF]+[('HUGINN_COURIER_QR','ON'),('HUGINN_TARGET_PROFILE','DEV_HFS2_7PART'),('HUGINN_COURIER_DEV_ORIGIN',ORIGIN)]:
        need(re.search(r'^'+name+r':[^=]+='+re.escape(value)+r'$',cache,re.M),'Wrong CMake option '+name)
    desc=load(build/'project_description.json')
    for k,v in {'project_name':'lvgl_porting','project_version':VERSION,'target':'esp32s3','idf_path':SDK.as_posix()}.items():need(desc[k].replace('\\','/')==v,'Wrong metadata '+k)
    for k,v in {'project_path':ROOT,'build_dir':build,'config_file':build/'sdkconfig'}.items():need(Path(desc[k]).resolve()==v.resolve(),'Wrong metadata path '+k)
    commands=load(build/'compile_commands.json')
    diagnostic_selection(desc,commands)
    main=[c for c in commands if Path(c['file']).resolve()==(ROOT/'main/main.c').resolve()]
    need(len(main)==1,'Missing main command');command=main[0].get('command',' '.join(main[0].get('arguments',[])))
    need('-DHUGINN_DEV_HTTPS_AVAILABLE=1' in command and '-DLV_USE_QRCODE=1' in command,'HTTPS/pairing missing')
    for n in base.OFF:need(not re.search(r'-D'+n+r'(?:=|\s|$)',command),'Bench mode compiled '+n)
    need(any(ORIGIN in c.get('command',' '.join(c.get('arguments',[]))) and 'HFC_DEV_ALLOWED_ORIGIN' in c.get('command',' '.join(c.get('arguments',[]))) for c in commands),'AppOrigin missing from compile inputs')
    need(shlex.split((build/'app-flash_args').read_text())==['--flash_mode','dio','--flash_freq','80m','--flash_size','16MB','0x20000','lvgl_porting.bin'],'Unexpected app write args')
    flash=load(build/'flasher_args.json');need(flash['app']=={'offset':'0x20000','file':'lvgl_porting.bin','encrypted':'false'} and flash['extra_esptool_args']['chip']=='esp32s3','Unexpected write geometry')
    base.check_partition((build/'partition_table/partition-table.bin').read_bytes(),SAVED.read_bytes())
    base.check_image((build/'lvgl_porting.bin').read_bytes())
    nm=run([toolchain()['nm']['path'],'--defined-only',build/'lvgl_porting.elf'])
    for symbol in ('huginn_settings_send_diag_begin','huginn_settings_send_diag_end','huginn_settings_send_diag_tls','huginn_settings_send_diag_https'):
        need(re.search(r'\b'+symbol+r'$',nm,re.M),'Diagnostic symbol not linked: '+symbol)
    for n in ('esp-tls','esp_https_server'):need(('esp-idf/'+n+'/lib'+n+'.a') in (build/'lvgl_porting.map').read_text().replace('\\','/'),'Instrumented archive not linked '+n)
def finish(build,exit_code):
    need(not (build/'owner-build-result.json').exists(),'Preserve existing build result')
    if exit_code:
        save(build/'owner-build-result.json',{'successful':False,'exit_code':exit_code,'ended_epoch':time.time()});raise ValueError('Compilation failed; retained logs, no success receipt')
    try:
        s=check_start(build);effective(build)
        for p in ('lvgl_porting.bin','lvgl_porting.elf'):need((build/p).stat().st_mtime>=s['started_epoch'],'Stale artifact '+p)
        outputs={p:digest(build/p) for p in OUTPUTS}
        save(build/'owner-build-complete.json',{'start_sha256':digest(build/'owner-build-start.json'),'outputs':outputs})
        save(build/'owner-build-result.json',{'successful':True,'exit_code':0,'ended_epoch':time.time(),'complete_sha256':digest(build/'owner-build-complete.json')})
    except Exception as error:
        save(build/'owner-build-result.json',{'successful':False,'exit_code':0,'error':str(error),'ended_epoch':time.time()});raise
    print('Successful new Rev. 2.3 artifact sealed; no flash')
def verify(build):
    s=check_start(build);result=load(build/'owner-build-result.json');complete=load(build/'owner-build-complete.json')
    need(result['successful'] is True and result['exit_code']==0,'Build unsuccessful')
    need(result['complete_sha256']==digest(build/'owner-build-complete.json') and complete['start_sha256']==digest(build/'owner-build-start.json'),'Receipt changed')
    need({p:digest(build/p) for p in OUTPUTS}==complete['outputs'],'Artifact/configuration changed')
    for p in ('lvgl_porting.bin','lvgl_porting.elf'):need((build/p).stat().st_mtime>=s['started_epoch'],'Stale artifact '+p)
    effective(build)
    print('PASS '+VERSION+'; bytes='+str((build/'lvgl_porting.bin').stat().st_size)+'; SHA256='+digest(build/'lvgl_porting.bin'))
    print('Local instrumented components compiled/linked; origin '+ORIGIN+'; app-only 0x20000 / capacity 0x400000')
def flash(build):
    verify(build)
    # OWNER ONLY: entry resets into bootloader. All intermediate commands leave app stopped.
    stamp=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());dest=Path('C:/HuginnEIS/Evidence/REV2.3-COM5')/('flash-'+stamp);dest.mkdir(parents=True,exist_ok=False)
    def esp(args,first=False,last=False):
        subprocess.run([sys.executable,'-m','esptool','--chip','esp32s3','--port','COM5','--before','default_reset' if first else 'no_reset','--after','hard_reset' if last else 'no_reset',*map(str,args)],check=True)
    before=dest/'flash-before.private.bin';after=dest/'flash-after.private.bin'
    esp(['read_flash','0','0x1000000',before],first=True)
    esp(['verify_flash','0',before])
    data=before.read_bytes();need(len(data)==0x1000000,'Incomplete backup')
    table=(build/'partition_table/partition-table.bin').read_bytes();need(data[0x8000:0x8000+len(table)]==table,'Live partition incompatible; no write')
    need(data[0x10000:0x12000]==SAVED.read_bytes()[0x10000:0x12000],'OTA selection changed; no write')
    image=(build/'lvgl_porting.bin').read_bytes();base.check_image(image)
    save(dest/'prewrite.json',{'artifact_sha256':base.sha(image),'backup_sha256':digest(before),'offset':0x20000,'capacity':0x400000})
    esp(['write_flash','--flash_mode','keep','--flash_freq','keep','--flash_size','keep','0x20000',build/'lvgl_porting.bin'])
    esp(['read_flash','0','0x1000000',after]);actual=after.read_bytes();end=(0x20000+len(image)+4095)//4096*4096
    need(len(actual)==len(data) and actual[0x20000:0x20000+len(image)]==image,'App readback mismatch; stop')
    need(actual[:0x20000]==data[:0x20000] and actual[end:]==data[end:],'Outside app erase envelope changed; stop')
    save(dest/'verified.json',{'artifact_sha256':base.sha(image),'all_outside_app_envelope_unchanged':True,'readback_sha256':digest(after)})
    esp(['verify_flash','0x20000',build/'lvgl_porting.bin'],last=True)
    print('PASS COM5 app readback; normal boot requested. No capture started. '+dest.as_posix())
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=('prepare','check','start','build','finish','verify','flash'));parser.add_argument('--build',default=DEFAULT.as_posix());parser.add_argument('--preparation',default=EVIDENCE.as_posix());parser.add_argument('--exit-code',type=int)
    a=parser.parse_args()
    try:
        candidate=Path(a.preparation).resolve()
        need(candidate.parent==Path('C:/HuginnEIS/Evidence').resolve() and re.fullmatch(r'REV2\.3-PREPARATION(?:-[A-Za-z0-9.-]+)?',candidate.name),'Invalid preparation evidence path')
        EVIDENCE=candidate
        b=build_path(a.build)
        if a.action=='prepare':prepare()
        elif a.action=='check':prepared();print('PASS prepared sources/SDK/toolchain; target compilation remains pending')
        elif a.action=='start':start(b)
        elif a.action=='build':owner_build(b)
        elif a.action=='finish':need(a.exit_code is not None,'Build exit code required');finish(b,a.exit_code)
        elif a.action=='verify':verify(b)
        else:flash(b)
    except (ValueError,OSError,KeyError,TypeError,subprocess.SubprocessError) as e:parser.exit(1,'STOP: '+str(e)+'\n')
