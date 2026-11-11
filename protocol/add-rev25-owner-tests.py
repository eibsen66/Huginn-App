from pathlib import Path
p=Path('C:/HuginnAPP/protocol/test-rev25-owner.py');s=p.read_text();at=s.index("if __name__=='__main__':")
s=s[:at]+'''class NewRev25Tests(unittest.TestCase):
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
  path=helper.with_name('rev25_read_diagnostic.py');spec=importlib.util.spec_from_file_location('rev25reader',path);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
  with patch('sys.argv',['reader']),contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit) as raised:reader.main()
  self.assertEqual(raised.exception.code,2)
 def test_capture_wrapper_verifies_but_does_not_build(self):
  text=Path('C:/HuginnEIS/REV2.5-OWNER-CAPTURE.ps1').read_text()
  self.assertIn(' verify --build $BuildDir',text)
  self.assertNotIn(' build --build',text)
  self.assertLess(text.index(' verify --build'),text.index('rev25_capture.py'))

'''+s[at:];p.write_text(s,encoding='utf8')
