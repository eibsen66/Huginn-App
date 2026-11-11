"""Disposable host fixtures; no owner build/flash/capture script is executed."""
import ast,importlib.util,json,os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
helper=Path('C:/HuginnEIS/Tools/rev27_release.py')
spec=importlib.util.spec_from_file_location('rev27',helper);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class OwnerTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='rev27-owner-fixture-');self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);self.fw=self.root/'fw';self.fw.mkdir();(self.fw/'main').mkdir();(self.fw/'main/main.c').write_text('fixture')
  self.seed=self.root/'seed';self.seed.write_text('fixture configuration');self.saved=self.root/'saved';self.saved.write_bytes(bytes(0x1000000))
  self.evidence=self.root/'evidence';self.evidence.mkdir();self.build=self.fw/'build-rev2.7-fixture'
  for name,value in [('ROOT',self.fw),('SEED',self.seed),('SAVED',self.saved),('EVIDENCE',self.evidence),('SDK',self.root/'sdk')]:
   p=patch.object(r,name,value);p.start();self.addCleanup(p.stop)
  for name,value in [('toolchain',{'fixture':'toolchain'}),('scripts',{'fixture':'script'}),('diagnostic_inputs',{'fixture':'diag'}),('functional_inputs',{'fixture':'functional'})]:
   p=patch.object(r,name,return_value=value);p.start();self.addCleanup(p.stop)
  self.p={'revision':r.VERSION,'origin':r.ORIGIN,'sources':r.base.source_pins(self.fw),'diagnostics':r.diagnostic_inputs(),
          'functional':r.functional_inputs(),'toolchain':r.toolchain(),'scripts':r.scripts(),'seed_sha256':r.digest(self.seed),'saved_flash_sha256':r.digest(self.saved)}
  self.p['preservation_receipt_sha256']=r.digest(helper.with_name('rev27-preserved-inputs.json'))
  r.save(self.evidence/'prepared.json',self.p)
 def populate(self):
  r.start(self.build)
  for f in r.OUTPUTS:
   path=self.build/f;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(('new fixture '+f).encode())
 def sealed(self):
  self.populate()
  with patch.object(r,'effective'):r.finish(self.build,0)
 def test_fresh_inputs_pinned_before_build_and_existing_directory_rejected(self):
  r.start(self.build);before=(self.build/'owner-build-start.json').read_bytes()
  with self.assertRaises(ValueError):r.start(self.build)
  self.assertEqual(before,(self.build/'owner-build-start.json').read_bytes())
 def test_source_change_rejected(self):
  r.start(self.build);(self.fw/'main/main.c').write_text('changed')
  with self.assertRaisesRegex(ValueError,'Source changed'):r.check_start(self.build)
 def test_functional_proof_change_rejected(self):
  with patch.object(r,'functional_inputs',return_value={'changed':True}),self.assertRaisesRegex(ValueError,'Functional candidate'):r.prepared()
 def test_toolchain_and_script_changes_rejected(self):
  for name,reason in [('toolchain','Toolchain'),('scripts','Owner script')]:
   with patch.object(r,name,return_value={'changed':True}),self.assertRaisesRegex(ValueError,reason):r.prepared()
 def test_start_functional_identity_change_rejected(self):
  r.start(self.build);path=self.build/'owner-build-start.json';value=r.load(path);value['functional']={'changed':True};path.write_text(json.dumps(value))
  with self.assertRaisesRegex(ValueError,'Start provenance'):r.check_start(self.build)
 def test_seed_change_rejected(self):
  self.seed.write_text('changed');
  with self.assertRaisesRegex(ValueError,'Preserved'):r.prepared()
 def test_failed_build_cannot_verify(self):
  r.start(self.build)
  with self.assertRaises(ValueError):r.finish(self.build,1)
  self.assertFalse((self.build/'owner-build-complete.json').exists())
  self.assertFalse(r.load(self.build/'owner-build-result.json')['successful'])
  with self.assertRaises((ValueError,OSError)):r.verify(self.build)
 def test_stale_artifact_not_sealed(self):
  self.populate();os.utime(self.build/'lvgl_porting.bin',(1,1))
  with patch.object(r,'effective'),self.assertRaisesRegex(ValueError,'Stale'):r.finish(self.build,0)
  self.assertFalse(r.load(self.build/'owner-build-result.json')['successful'])
 def test_success_and_changed_output_rejected(self):
  self.sealed()
  with patch.object(r,'effective'):r.verify(self.build)
  (self.build/'lvgl_porting.bin').write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'Artifact'):r.verify(self.build)
 def test_failed_attempt_retained_fresh_retry_pinned(self):
  r.start(self.build)
  with self.assertRaises(ValueError):r.finish(self.build,2)
  before=(self.build/'owner-build-result.json').read_bytes();other=self.fw/'build-rev2.7-retry01';r.start(other)
  self.assertEqual(before,(self.build/'owner-build-result.json').read_bytes());self.assertTrue((other/'owner-build-start.json').exists())
 def test_local_component_selection_and_missing_shared_rejection(self):
  desc={'build_component_info':{n:{'dir':str(self.fw/'components'/n)} for n in ('esp-tls','esp_https_server','mbedtls')}}
  commands=[{'file':str(self.fw/'components'/n/f),'command':'gcc '+str(self.fw/'components'/n/f)} for n,f in [('esp-tls','esp_tls_mbedtls.c'),('esp-tls','huginn_settings_send_diag.c'),('esp_https_server','src/https_server.c'),('mbedtls','port/aes/dma/esp_aes_dma_core.c'),('mbedtls','port/huginn_aes_alloc_diag.c'),('mbedtls','port/dynamic/esp_ssl_tls.c')]]
  r.diagnostic_selection(desc,commands)
  with self.assertRaises(ValueError):r.diagnostic_selection(desc,commands[:-1])
  extra={'file':str(r.SDK/'components/esp-tls/esp_tls_mbedtls.c'),'command':'gcc uninstrumented'}
  with self.assertRaisesRegex(ValueError,'Shared'):r.diagnostic_selection(desc,commands+[extra])
  desc['build_component_info']['esp-tls']['dir']=str(r.SDK/'components/esp-tls')
  with self.assertRaisesRegex(ValueError,'not selected'):r.diagnostic_selection(desc,commands)
 def test_allocation_reader_sanitizes_strings_and_other_content(self):
  path=helper.with_name('rev27_read_diagnostic.py');sp=importlib.util.spec_from_file_location('reader24',path);reader=importlib.util.module_from_spec(sp);sp.loader.exec_module(reader)
  sample='I (20) HS2_ALLOC: failure id=1 index=0 bytes=1600 caps=8 site=bounce_output function=esp_aes_process_dma_ext_ram line=280 task=123 elapsed_us=70 bearer=secret\nI (21) HS2_ALLOC: summary id=1 records=1 dropped=0 task=123 name=private\n'
  rows=reader.allocation_records(sample);self.assertEqual(len(rows),2);self.assertEqual(rows[0]['bytes'],1600);self.assertEqual(rows[0]['site'],'bounce_output')
  self.assertNotIn('secret',json.dumps(rows));self.assertNotIn('private',json.dumps(rows))
  bad=reader.allocation_records('HS2_ALLOC: failure id=2 site=SECRET function=SECRET token=123')
  self.assertEqual(bad,[{'event':'failure','id':2}])
 def test_no_build_path_escape(self):
  with self.assertRaises(ValueError):r.build_path(str(self.root/'build-rev2.7-escape'))
  self.assertEqual(r.build_path(str(self.build)),self.build.resolve())
 def test_flash_is_app_only_with_verified_backup_and_protection(self):
  self.build.mkdir();(self.build/'partition_table').mkdir();(self.build/'partition_table/partition-table.bin').write_bytes(bytes(3072));(self.build/'lvgl_porting.bin').write_bytes(b'APP-FIXTURE')
  commands=[];state=bytearray(0x1000000)
  def fake(command,**kwargs):
   commands.append(command)
   if 'read_flash' in command:Path(command[-1]).write_bytes(state)
   if 'write_flash' in command:state[0x20000:0x20000+11]=b'APP-FIXTURE'
  original=Path
  # Redirect only newly created owner evidence to a disposable host folder.
  def path(value):return self.root/'flash-evidence' if str(value)=='C:/HuginnEIS/Evidence/REV2.7-COM5' else original(value)
  with patch.object(r,'verify'),patch.object(r.base,'check_image'),patch.object(r,'Path',side_effect=path),patch.object(r.subprocess,'run',side_effect=fake):r.flash(self.build)
  writes=[c for c in commands if 'write_flash' in c];self.assertEqual(len(writes),1);self.assertEqual(writes[0][-2],'0x20000')
  self.assertTrue(all('COM5' in c for c in commands));self.assertIn('hard_reset',commands[-1]);self.assertIn('verify_flash',commands[-1])
 def test_capture_is_exclusive_read_only_without_line_or_baud_reset_calls(self):
  text=Path('C:/HuginnEIS/Tools/rev27_capture.py').read_text();ast.parse(text)
  for forbidden in ('SetCommState','EscapeCommFunction','WriteFile','SetDTR','SetRTS','esptool','subprocess'):
   self.assertNotIn(forbidden,text)
  self.assertIn("handle=k.CreateFileW(r'\\\\.\\COM5',0x80000000,0,None,3,0,None)",text)
  self.assertIn("'automatic_reconnect':False",text)
 def test_saved_summary_only_keeps_numeric_allowlisted_fields(self):
  path=Path('C:/HuginnEIS/Tools/rev27_read_diagnostic.py');sp=importlib.util.spec_from_file_location('reader',path);reader=importlib.util.module_from_spec(sp);sp.loader.exec_module(reader)
  found=reader.records('I (10) HS2_SEND: begin id=2 bytes=29502 token=123 SECRET\nI (20) HS2_SEND: end id=2 bytes=29502 tls_body_accepted=20480 http_result=-1 raw_tls=-78 tls_errno=11 elapsed_us=5000000\nOther SECRET')
  self.assertEqual(len(found),2);self.assertNotIn('token',str(found));self.assertNotIn('SECRET',str(found));self.assertEqual(found[1]['tls_body_accepted'],20480)
class NewRev27Tests(unittest.TestCase):
 def test_reviewed_functional_identity_is_required(self):
  result=r.functional_inputs();self.assertEqual(result['scratch_bytes'],1024)
  with patch.object(r,'digest',return_value='mismatch'),self.assertRaisesRegex(ValueError,'Functional candidate'):r.functional_inputs()
 def test_pairing_source_and_linkage_are_required(self):
  path=(r.ROOT/'main/huginn_flight_pairing_ui.c').resolve()
  commands=[{'file':str(path),'command':'gcc '+str(path)}]
  map_text='esp-idf/main/libmain.a(huginn_flight_pairing_ui.c.obj)'
  nm='42000000 T hfp_ui_open'
  r.pairing_selection(commands,map_text,nm)
  for c,m,n in [([],map_text,nm),(commands,'',nm),(commands,map_text,''),(commands+commands,map_text,nm)]:
   with self.assertRaises(ValueError):r.pairing_selection(c,m,n)
 def test_reader_requires_an_explicit_capture_folder(self):
  import contextlib,io
  path=helper.with_name('rev27_read_diagnostic.py');spec=importlib.util.spec_from_file_location('rev27reader',path);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
  with patch('sys.argv',['reader']),contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit) as raised:reader.main()
  self.assertEqual(raised.exception.code,2)
 def test_capture_wrapper_verifies_but_does_not_build(self):
  text=Path('C:/HuginnEIS/REV2.7-OWNER-CAPTURE.ps1').read_text()
  self.assertIn(' verify --build $BuildDir',text)
  self.assertNotIn(' build --build',text)
  self.assertLess(text.index(' verify --build'),text.index('rev27_capture.py'))

class HeapReaderTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  path=helper.with_name('rev27_read_diagnostic.py');spec=importlib.util.spec_from_file_location('reader26',path);cls.reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.reader)
 def sample(self):
  text=Path('C:/HuginnAPP/build/rev26-preparation/probe-host.log').read_text();return next(l for l in text.splitlines() if l.startswith('HS2_DMA_HEAP:'))
 def test_complete_measurement_is_sanitized_and_all_fields_survive(self):
  rows=self.reader.dma_heap_records(self.sample()+' secret=123 token=SECRET')
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['caps'],8);self.assertEqual(rows[0]['output_mod_cache'],21);self.assertNotIn('secret',str(rows));self.assertNotIn('token',str(rows));self.assertNotIn('SECRET',str(rows))
 def test_truncated_duplicate_and_wrong_site_measurements_rejected(self):
  self.assertEqual(self.reader.dma_heap_records(self.sample().replace('cache_result=0','')),[])
  self.assertEqual(self.reader.dma_heap_records(self.sample()+' id=2'),[])
  self.assertEqual(self.reader.dma_heap_records(self.sample().replace('site=bounce_output','site=other')),[])
 def fixture(self):
  sends=[{'event':'begin','id':1,'bytes':29502},{'event':'end','id':1,'bytes':29502,'tls_body_accepted':4096,'http_result':45062}]
  alloc=[{'event':'summary','id':1,'records':1,'dropped':0,'task':1},{'event':'failure','id':1,'task':1,'bytes':1600,'caps':8,'site':'bounce_output','function':'esp_aes_process_dma_ext_ram','line':278,'elapsed_us':2}]
  return sends,alloc,self.reader.dma_heap_records(self.sample())
 def test_complete_request_correlates_and_mismatches_do_not(self):
  sends,alloc,heaps=self.fixture();self.assertEqual(self.reader.request_correlations(sends,alloc,heaps)[0]['status'],'complete_first_output_failure_observation')
  for heap in [{**heaps[0],'task':2},{**heaps[0],'bytes':32}]:self.assertEqual(self.reader.request_correlations(sends,alloc,[heap])[0]['status'],'incomplete_observation')
  self.assertEqual(self.reader.request_correlations(sends,alloc,[])[0]['status'],'incomplete_observation')
  self.assertEqual(self.reader.request_correlations(sends,alloc,heaps+heaps)[0]['status'],'incomplete_observation')
  alloc[0]['dropped']=1;self.assertEqual(self.reader.request_correlations(sends,alloc,heaps)[0]['status'],'incomplete_observation')
 def test_success_without_allocation_failure_does_not_invent_sample(self):
  sends,_,_=self.fixture();rows=self.reader.request_correlations(sends,[{'event':'summary','id':1,'records':0,'dropped':0,'task':1}],[])
  self.assertEqual(rows[0]['status'],'no_output_allocation_failure_recorded')

if __name__=='__main__':unittest.main(verbosity=2)
