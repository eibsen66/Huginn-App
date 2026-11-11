from pathlib import Path
p=Path('C:/HuginnEIS/Tools/rev26_read_diagnostic.py');s=p.read_text()
s=s.replace("        if 'HS2_DMA_HEAP:' not in line:continue\n        fields={k:int(v) for k,v in re.findall(r'\\b([a-z_0-9]+)=(-?\\d+)\\b',line.split('HS2_DMA_HEAP:',1)[1]) if k in DMA_FIELDS}\n        if set(fields)!=DMA_FIELDS:continue", "        if 'HS2_DMA_HEAP:' not in line:continue\n        if not re.search(r'\\bsite=bounce_output\\b',line) or not re.search(r'\\bfunction=esp_aes_process_dma_ext_ram\\b',line):continue\n        items=[(k,int(v)) for k,v in re.findall(r'\\b([a-z_0-9]+)=(-?\\d+)\\b',line.split('HS2_DMA_HEAP:',1)[1]) if k in DMA_FIELDS]\n        fields=dict(items)\n        if len(items)!=len(DMA_FIELDS) or set(fields)!=DMA_FIELDS:continue")
s=s.replace("complete=len(begins)==1 and len(summaries)==1", "complete=len(begins)==1 and len(summaries)==1 and sum(1 for r in sends if r.get('id')==rid and r.get('event')=='end')==1")
s=s.replace("complete=complete and all(r.get('task')==summary.get('task') for r in failures)", "complete=complete and isinstance(summary.get('task'),int) and all(r.get('task')==summary.get('task') and {'site','function','bytes','caps','line','elapsed_us'}<=r.keys() for r in failures)")
p.write_text(s,encoding='utf8',newline='\n')
p=Path('C:/HuginnAPP/protocol/test-rev26-owner.py');s=p.read_text();at=s.index("if __name__=='__main__':")
s=s[:at]+'''class HeapReaderTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  path=helper.with_name('rev26_read_diagnostic.py');spec=importlib.util.spec_from_file_location('reader26',path);cls.reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.reader)
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

'''+s[at:];p.write_text(s,encoding='utf8')
