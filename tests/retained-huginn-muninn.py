from pathlib import Path
import sys,json,tempfile
sys.dont_write_bytecode=True
sys.path.insert(0,r'C:\Muninn')
from muninn_app.hfl_codec import decode_hfl
from muninn_app.flight_database import FlightDatabase
source=Path(sys.argv[1]);export=Path(sys.argv[2]);output=Path(sys.argv[3])
assert export.resolve().is_relative_to(output.resolve())
raw=export.read_bytes();assert raw==source.read_bytes()
e=decode_hfl(raw);assert e.evidence_acceptance=='ACCEPTED' and e.parsed_classification=='COMPLETE'
directory=Path(tempfile.mkdtemp(prefix='muninn-selected-',dir=output));database=directory/'flights.db'
with FlightDatabase(database,create=True) as db:
 entry=db.archive(raw,source.name);assert entry.archive_state=='ACCEPTED_EVIDENCE';assert db.load(entry.id).evidence.original_bytes==raw;db.verify()
with FlightDatabase(database,readonly=True) as db:
 entries=db.list_entries();assert len(entries)==1;assert db.load(entries[0].id).evidence.original_bytes==raw
print(json.dumps({'result':'HOST browser export -> unchanged Muninn codec/archive/readback PASS','classification':e.parsed_classification,'acceptance':e.evidence_acceptance,'replay_eligible':e.replay_eligible,'bytes':e.physical_bytes,'sha256':e.physical_sha256,'session_id':e.session_id,'header_crc_valid':e.header_crc_valid,'record_crc_valid':e.record_crc_valid,'sequence_valid':e.sequence_valid,'monotonic_time_valid':e.timestamp_order_valid,'valid_prefix_bytes':e.valid_prefix_bytes,'tail_bytes':len(e.remainder_bytes),'database':str(database),'source_provenance':'UNKNOWN; saved historical backup, no authenticated device-transfer claim','FULL_ACK_GATE_PASS':False}))
