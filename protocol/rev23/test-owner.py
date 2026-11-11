"""Disposable host fixtures; no owner build/flash/capture script is executed."""
import ast,importlib.util,json,os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
helper=Path('C:/HuginnEIS/Tools/rev23_release.py')
spec=importlib.util.spec_from_file_location('rev23',helper);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class OwnerTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='rev23-owner-fixture-');self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);self.fw=self.root/'fw';self.fw.mkdir();(self.fw/'main').mkdir();(self.fw/'main/main.c').write_text('fixture')
  self.seed=self.root/'seed';self.seed.write_text('fixture configuration');self.saved=self.root/'saved';self.saved.write_bytes(bytes(0x1000000))
  self.evidence=self.root/'evidence';self.evidence.mkdir();self.build=self.fw/'build-rev2.3-fixture'
  for name,value in [('ROOT',self.fw),('SEED',self.seed),('SAVED',self.saved),('EVIDENCE',self.evidence),('SDK',self.root/'sdk')]:
   p=patch.object(r,name,value);p.start();self.addCleanup(p.stop)
  for name,value in [('toolchain',{'fixture':'toolchain'}),('scripts',{'fixture':'script'}),('diagnostic_inputs',{'fixture':'diag'})]:
   p=patch.object(r,name,return_value=value);p.start();self.addCleanup(p.stop)
  self.p={'revision':r.VERSION,'origin':r.ORIGIN,'sources':r.base.source_pins(self.fw),'diagnostics':r.diagnostic_inputs(),
          'toolchain':r.toolchain(),'scripts':r.scripts(),'seed_sha256':r.digest(self.seed),'saved_flash_sha256':r.digest(self.saved)}
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
  before=(self.build/'owner-build-result.json').read_bytes();other=self.fw/'build-rev2.3-retry01';r.start(other)
  self.assertEqual(before,(self.build/'owner-build-result.json').read_bytes());self.assertTrue((other/'owner-build-start.json').exists())
 def test_local_component_selection_and_missing_shared_rejection(self):
  desc={'build_component_info':{n:{'dir':str(self.fw/'components'/n)} for n in ('esp-tls','esp_https_server')}}
  commands=[{'file':str(self.fw/'components'/n/f),'command':'gcc '+str(self.fw/'components'/n/f)} for n,f in [('esp-tls','esp_tls_mbedtls.c'),('esp-tls','huginn_settings_send_diag.c'),('esp_https_server','src/https_server.c')]]
  r.diagnostic_selection(desc,commands)
  with self.assertRaises(ValueError):r.diagnostic_selection(desc,commands[:-1])
  extra={'file':str(r.SDK/'components/esp-tls/esp_tls_mbedtls.c'),'command':'gcc uninstrumented'}
  with self.assertRaisesRegex(ValueError,'Shared'):r.diagnostic_selection(desc,commands+[extra])
  desc['build_component_info']['esp-tls']['dir']=str(r.SDK/'components/esp-tls')
  with self.assertRaisesRegex(ValueError,'not selected'):r.diagnostic_selection(desc,commands)
 def test_no_build_path_escape(self):
  with self.assertRaises(ValueError):r.build_path(str(self.root/'build-rev2.3-escape'))
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
  def path(value):return self.root/'flash-evidence' if str(value)=='C:/HuginnEIS/Evidence/REV2.3-COM5' else original(value)
  with patch.object(r,'verify'),patch.object(r.base,'check_image'),patch.object(r,'Path',side_effect=path),patch.object(r.subprocess,'run',side_effect=fake):r.flash(self.build)
  writes=[c for c in commands if 'write_flash' in c];self.assertEqual(len(writes),1);self.assertEqual(writes[0][-2],'0x20000')
  self.assertTrue(all('COM5' in c for c in commands));self.assertIn('hard_reset',commands[-1]);self.assertIn('verify_flash',commands[-1])
 def test_capture_is_exclusive_read_only_without_line_or_baud_reset_calls(self):
  text=Path('C:/HuginnEIS/Tools/rev23_capture.py').read_text();ast.parse(text)
  for forbidden in ('SetCommState','EscapeCommFunction','WriteFile','SetDTR','SetRTS','esptool','subprocess'):
   self.assertNotIn(forbidden,text)
  self.assertIn("handle=k.CreateFileW(r'\\\\.\\COM5',0x80000000,0,None,3,0,None)",text)
  self.assertIn("'automatic_reconnect':False",text)
 def test_saved_summary_only_keeps_numeric_allowlisted_fields(self):
  path=Path('C:/HuginnEIS/Tools/rev23_read_diagnostic.py');sp=importlib.util.spec_from_file_location('reader',path);reader=importlib.util.module_from_spec(sp);sp.loader.exec_module(reader)
  found=reader.records('I (10) HS2_SEND: begin id=2 bytes=29502 token=123 SECRET\nI (20) HS2_SEND: end id=2 bytes=29502 tls_body_accepted=20480 http_result=-1 raw_tls=-78 tls_errno=11 elapsed_us=5000000\nOther SECRET')
  self.assertEqual(len(found),2);self.assertNotIn('token',str(found));self.assertNotIn('SECRET',str(found));self.assertEqual(found[1]['tls_body_accepted'],20480)
if __name__=='__main__':unittest.main(verbosity=2)
