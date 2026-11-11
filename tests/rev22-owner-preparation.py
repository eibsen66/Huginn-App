"""Synthetic artifact checks only; never invokes firmware scripts or COM5."""
import contextlib, hashlib, importlib.util, io, json, os, struct, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('release',os.environ.get('REV22_HELPER','/mnt/c/HuginnAPP/build/rev22-preparation/rev22_release.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
CONFIG='\n'.join(('CONFIG_IDF_TARGET="esp32s3"','CONFIG_PARTITION_TABLE_CUSTOM=y',
 'CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"','CONFIG_PARTITION_TABLE_OFFSET=0x8000',
 'CONFIG_ESPTOOLPY_FLASHSIZE="16MB"','CONFIG_FREERTOS_TASK_CREATE_ALLOW_EXT_MEM=y',
 'CONFIG_SPIRAM_ALLOW_STACK_EXTERNAL_MEMORY=y','CONFIG_MBEDTLS_EXTERNAL_MEM_ALLOC=y'))
def image():
 d=bytearray(288);d[0]=0xE9;d[1]=1;d[12]=9;d[23]=1
 struct.pack_into('<II',d,24,0x3C000020,256);struct.pack_into('<I',d,32,0xABCD5432)
 for offset,value in ((48,r.VERSION),(80,'lvgl_porting'),(144,'v5.5.2')): d[offset:offset+len(value)]=value.encode()
 checksum=0xEF
 for b in d[32:]: checksum^=b
 d.extend(bytes(15));d.append(checksum);d.extend(hashlib.sha256(d).digest());return bytes(d)
class ReleaseTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='rev22-fixture-');self.addCleanup(self.temp.cleanup)
  self.base=Path(self.temp.name);self.root=self.base/'source';self.root.mkdir();self.build=self.root/'fresh-build'
  self.seed=self.base/'seed';self.seed.write_text(CONFIG);self.saved=self.base/'saved-flash'
  entries=[('nvs',1,2,0x9000,0x6000),('phy_init',1,1,0xF000,0x1000),('otadata',1,0,0x10000,0x2000),
   ('ota_0',0,16,0x20000,0x400000),('ota_1',0,17,0x420000,0x400000),('storage',1,130,0x820000,0x7DC000),('hfs2raw',1,64,0xFFC000,0x4000)]
  self.table=b''.join(struct.pack('<HBBII16sI',0x50AA,t,sub,off,size,label.encode(),0) for label,t,sub,off,size in entries)+bytes([255])*32
  d=bytearray(0x1000000);d[0x8000:0x8000+len(self.table)]=self.table;self.saved.write_bytes(d)
  for name,text in [('CMakeLists.txt',f'set(PROJECT_VER "{r.VERSION}")'),('main/main.c',f'#define HUGINN_BUILD_ID "{r.VERSION}"'),
   ('main/credentials/huginn_wifi_ap_password.h','fixture only'),('main/dev_https_local/huginn_dev_server_cert.pem','fixture cert'),('main/dev_https_local/huginn_dev_server_key.pem','fixture key')]:
   p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
  self.origin='https://localhost:8443'
 def start(self): r.start(self.root,self.build,self.seed,self.saved,self.origin)
 def populated(self):
  self.start()
  for name in r.OUTPUTS:
   p=self.build/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'fixture')
  (self.build/'lvgl_porting.bin').write_bytes(image());(self.build/'partition_table/partition-table.bin').write_bytes(self.table)
  (self.build/'sdkconfig').write_text(CONFIG)
  (self.build/'app-flash_args').write_text('--flash_mode dio --flash_freq 80m --flash_size 16MB\n0x20000 lvgl_porting.bin\n')
  (self.build/'CMakeCache.txt').write_text('\n'.join([n+':BOOL=OFF' for n in r.OFF]+['HUGINN_COURIER_QR:BOOL=ON','HUGINN_TARGET_PROFILE:STRING=DEV_HFS2_7PART','HUGINN_COURIER_DEV_ORIGIN:STRING='+self.origin]))
  project={'project_name':'lvgl_porting','project_version':r.VERSION,'target':'esp32s3','app_bin':'lvgl_porting.bin','idf_path':'C:/esp/v5.5.2/esp-idf',
   'project_path':str(self.root),'build_dir':str(self.build),'config_file':str(self.build/'sdkconfig')}
  (self.build/'project_description.json').write_text(json.dumps(project))
  (self.build/'flasher_args.json').write_text(json.dumps({'app':{'offset':'0x20000','file':'lvgl_porting.bin','encrypted':'false'},'extra_esptool_args':{'chip':'esp32s3'}}))
  (self.build/'compile_commands.json').write_text(json.dumps([{'file':str(self.root/'main/main.c'),'command':'gcc -DHUGINN_DEV_HTTPS_AVAILABLE=1 -DLV_USE_QRCODE=1'},
   {'file':'auth.c','command':'gcc -DHFC_DEV_ALLOWED_ORIGIN="'+self.origin+'"'}]))
 def seal(self): r.seal(self.root,self.build)
 def verify(self):
  with contextlib.redirect_stdout(io.StringIO()): r.verify(self.root,self.build,self.saved)
 def test_fresh_receipt_verify_preserves_seed(self):
  before=r.digest(self.seed);self.populated();self.seal();self.verify();self.assertEqual(before,r.digest(self.seed))
 def test_existing_build_refused(self):
  self.start()
  with self.assertRaisesRegex(ValueError,'existing build'): self.start()
 def test_origin_exact_https_only(self):
  for v in ('http://localhost:8443','https://host/path','https://*.host','https://user@host','https://host;bad',''):
   with self.subTest(value=v),self.assertRaises(ValueError): r.origin(v)
 def test_private_inputs_required_before_directory_creation(self):
  (self.root/'main/dev_https_local/huginn_dev_server_key.pem').unlink()
  with self.assertRaisesRegex(ValueError,'private'): self.start()
  self.assertFalse(self.build.exists())
 def test_source_change_refused(self):
  self.populated();(self.root/'main/main.c').write_text('changed')
  with self.assertRaisesRegex(ValueError,'Source'): self.seal()
 def test_output_hash_change_refused(self):
  self.populated();self.seal();(self.build/'lvgl_porting.bin').write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'hash changed'): self.verify()
 def test_image_revision_target_sdk_checksum_digest_and_size(self):
  for offset,value in ((48,ord('X')),(12,0),(144,ord('X')),(303,0),(320,0)):
   d=bytearray(image());d[offset]=value
   with self.subTest(offset=offset),self.assertRaises(ValueError): r.check_image(bytes(d))
  with self.assertRaises(ValueError): r.check_image(bytes(0x400001))
 def test_partition_bytes_and_geometry(self):
  r.check_partition(self.table,self.saved.read_bytes());d=bytearray(self.table);d[108]^=1
  with self.assertRaises(ValueError): r.check_partition(d,self.saved.read_bytes())
  saved=bytearray(self.saved.read_bytes());saved[0x8000:0x8000+len(d)]=d
  with self.assertRaisesRegex(ValueError,'geometry'): r.check_partition(d,saved)
 def test_modes_origin_metadata_and_flash_bounds(self):
  self.populated()
  for name,old,new in [('CMakeCache.txt','HUGINN_REC_HOUR_TEST:BOOL=OFF','HUGINN_REC_HOUR_TEST:BOOL=ON'),
   ('CMakeCache.txt','HUGINN_LOCAL_RECORDING_ONLY:BOOL=OFF','HUGINN_LOCAL_RECORDING_ONLY:BOOL=ON'),
   ('CMakeCache.txt','HUGINN_COURIER_QR:BOOL=ON','HUGINN_COURIER_QR:BOOL=OFF'),
   ('app-flash_args','0x20000','0x10000'),('app-flash_args','0x20000 lvgl_porting.bin','0x20000 lvgl_porting.bin 0x8000 partition-table.bin'),
   ('compile_commands.json','-DHUGINN_DEV_HTTPS_AVAILABLE=1',''),('compile_commands.json','-DLV_USE_QRCODE=1','-DHUGINN_DEMO_FLG_BENCH=1'),
   ('compile_commands.json',self.origin,'https://wrong.example'),('project_description.json','esp32s3','esp32')]:
   p=self.build/name;original=p.read_text();p.write_text(original.replace(old,new));self.seal()
   with self.subTest(name=name,new=new),self.assertRaises(ValueError): self.verify()
   (self.build/'owner-build-complete.json').unlink();p.write_text(original)
 def test_missing_completion_and_stale_binary(self):
  self.populated()
  with self.assertRaises(FileNotFoundError): self.verify()
  os.utime(self.build/'lvgl_porting.bin',(0,0))
  with self.assertRaisesRegex(ValueError,'Stale'): self.seal()
if __name__=='__main__': unittest.main()
