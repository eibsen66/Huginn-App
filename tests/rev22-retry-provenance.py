"""Temporary synthetic artifacts only. No IDF compilation or owner script execution."""
import importlib.util,os,sys,time,unittest
from pathlib import Path
from unittest.mock import patch
helper=Path(os.environ.get('REV22_HELPER','C:/HuginnAPP/build/rev22-retry-preparation/rev22_release.py'))
sys.path.insert(0,str(helper.parent))
import rev22_retry as retry
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('rev22-owner-preparation.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
r=base.r
class RetryTests(base.ReleaseTests):
 def setUp(self):
  super().setUp();self.origin=retry.ORIGIN;self.toolchain={'compiler':{'version':'fixture-toolchain','sha256':'fixture-hash'}}
 def prepared(self):
  self.populated();(self.build/'config').mkdir();(self.build/'config/sdkconfig.h').write_text('fixture config')
  (self.build/'lvgl_porting.bin').write_bytes(b'old artifact');(self.build/'lvgl_porting.elf').write_bytes(b'old elf')
  (self.build/'log').mkdir();(self.build/'log/failed.log').write_text('failure evidence')
  retry.prepare(r,self.root,self.build,self.saved,self.toolchain)
 def begin(self): retry.begin(r,self.root,self.build,self.saved,self.toolchain)
 def finish(self,code=0): retry.finish(r,self.root,self.build,self.saved,self.toolchain,code)
 def new_artifacts(self):
  (self.build/'lvgl_porting.bin').write_bytes(base.image());(self.build/'lvgl_porting.elf').write_bytes(b'new elf')
 def verified(self):
  with patch.object(retry,'tools',return_value=self.toolchain): self.verify()
 def test_retry_success_full_verify_and_originals_preserved(self):
  self.prepared();original=(self.build/'owner-build-start.json').read_bytes();log=(self.build/'log/failed.log').read_bytes()
  self.begin();self.new_artifacts();self.finish();self.verified()
  self.assertEqual(original,(self.build/'owner-build-start.json').read_bytes());self.assertEqual(log,(self.build/'log/failed.log').read_bytes())
 def test_prepared_only_cannot_verify_or_fallback(self):
  self.prepared()
  with self.assertRaises(FileNotFoundError): self.verified()
 def test_retry_source_and_config_mutation_refused_before_build(self):
  self.prepared();p=self.root/'main/main.c';old=p.read_bytes();p.write_bytes(old+b'changed')
  with self.assertRaisesRegex(ValueError,'Source'): self.begin()
  p.write_bytes(old);(self.build/'sdkconfig').write_text(base.CONFIG+'\n# changed')
  with self.assertRaisesRegex(ValueError,'configuration input'): self.begin()
 def test_toolchain_mutation_refused(self):
  self.prepared();self.toolchain={'compiler':'changed'}
  with self.assertRaisesRegex(ValueError,'toolchain'): self.begin()
 def test_failed_build_never_seals_even_with_fresh_artifact(self):
  self.prepared();self.begin();self.new_artifacts()
  with self.assertRaisesRegex(ValueError,'compilation failed'): self.finish(1)
  self.assertFalse((self.build/'owner-retry/complete.json').exists())
  with self.assertRaisesRegex(ValueError,'successfully'): self.verified()
 def test_success_exit_with_old_artifact_refused(self):
  self.prepared();self.begin()
  with self.assertRaisesRegex(ValueError,'Stale|reused'): self.finish()
 def test_touching_old_artifact_does_not_make_new(self):
  self.prepared();self.begin()
  for n in ('lvgl_porting.bin','lvgl_porting.elf'): os.utime(self.build/n,None)
  with self.assertRaisesRegex(ValueError,'reused'): self.finish()
 def test_source_change_after_success_refused(self):
  self.prepared();self.begin();self.new_artifacts();self.finish();(self.root/'main/main.c').write_text('changed')
  with self.assertRaisesRegex(ValueError,'Source'): self.verified()
 def test_output_change_after_success_refused(self):
  self.prepared();self.begin();self.new_artifacts();self.finish();(self.build/'lvgl_porting.bin').write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'hash changed'): self.verified()
 def test_original_evidence_change_refused(self):
  self.prepared();(self.build/'log/failed.log').write_text('overwritten')
  with self.assertRaisesRegex(ValueError,'Original evidence'): self.begin()
 def test_repeat_prepare_and_begin_refused(self):
  self.prepared()
  with self.assertRaisesRegex(ValueError,'already exists'): retry.prepare(r,self.root,self.build,self.saved,self.toolchain)
  self.begin()
  with self.assertRaisesRegex(ValueError,'already attempted'): self.begin()
 def test_completed_receipt_tamper_refused(self):
  self.prepared();self.begin();self.new_artifacts();self.finish();p=self.build/'owner-retry/complete.json';p.write_text('{}')
  with self.assertRaisesRegex(ValueError,'completion changed'): self.verified()
if __name__=='__main__': unittest.main()
