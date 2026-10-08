import Foundation
import SQLite3

// All access is confined to FlightCourierPlugin's serial queue.
final class CourierStore {
    private var db: OpaquePointer?;private let path: URL;private let credentials=CourierCredentials()
    private let transient=unsafeBitCast(-1,to:sqlite3_destructor_type.self)
    init() throws {
        let fm=FileManager.default;let base=try fm.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent("FlightCourier",isDirectory:true)
        try fm.createDirectory(at:base,withIntermediateDirectories:true,attributes:[.protectionKey:FileProtectionType.complete])
        var excluded=base;var values=URLResourceValues();values.isExcludedFromBackup=true;try excluded.setResourceValues(values)
        path=base.appendingPathComponent("flight-courier-v1.sqlite");try open()
    }
    deinit { sqlite3_close(db) }
    func open() throws {
        try require(sqlite3_open_v2(path.path,&db,SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE|SQLITE_OPEN_FULLMUTEX,nil)==SQLITE_OK,"SQLITE_OPEN")
        _=try rows("PRAGMA journal_mode=DELETE");try run("PRAGMA synchronous=EXTRA");try run("PRAGMA foreign_keys=ON");sqlite3_busy_timeout(db,5000)
        try require(try number("PRAGMA user_version")<=1,"SCHEMA_VERSION")
        guard let url=Bundle.main.url(forResource:"schema",withExtension:"sql",subdirectory:"public/mobile") else { throw CourierError("SCHEMA_RESOURCE") }
        let schema=try String(contentsOf:url,encoding:.utf8)
        try transaction { for line in schema.split(separator:"\n") { if !line.hasPrefix("--") { try run(String(line)) } } }
    }
    func statement(_ sql: String,_ args: [Any]) throws -> OpaquePointer {
        var p: OpaquePointer?;try require(sqlite3_prepare_v2(db,sql,-1,&p,nil)==SQLITE_OK,"SQLITE_PREPARE");guard let s=p else { throw CourierError("SQLITE_PREPARE") }
        do { for (i,a) in args.enumerated() { let n=Int32(i+1);var rc: Int32
            if let b=a as? Data { rc=b.withUnsafeBytes { sqlite3_bind_blob(s,n,$0.baseAddress,Int32(b.count),transient) } }
            else if let v=a as? Int64 { rc=sqlite3_bind_int64(s,n,v) }
            else if let v=a as? String { rc=v.withCString { sqlite3_bind_text(s,n,$0,-1,transient) } }
            else { throw CourierError("SQLITE_BIND_TYPE") };try require(rc==SQLITE_OK,"SQLITE_BIND")
        };return s } catch { sqlite3_finalize(s);throw error }
    }
    func run(_ sql: String,_ args: [Any]=[]) throws { let s=try statement(sql,args);defer { sqlite3_finalize(s) };try require(sqlite3_step(s)==SQLITE_DONE,"SQLITE_WRITE") }
    func rows(_ sql: String,_ args: [Any]=[]) throws -> [[Any]] {
        let s=try statement(sql,args);defer { sqlite3_finalize(s) };var result=[[Any]]();var rc=sqlite3_step(s)
        while rc==SQLITE_ROW { var row=[Any]();for i in 0..<sqlite3_column_count(s) { switch sqlite3_column_type(s,i) { case SQLITE_BLOB:let n=Int(sqlite3_column_bytes(s,i));if n==0 { row.append(Data()) } else { row.append(Data(bytes:sqlite3_column_blob(s,i)!,count:n)) };case SQLITE_INTEGER:row.append(sqlite3_column_int64(s,i));case SQLITE_TEXT:row.append(String(cString:sqlite3_column_text(s,i)));default:row.append(NSNull()) } };result.append(row);rc=sqlite3_step(s) }
        try require(rc==SQLITE_DONE,"SQLITE_READ");return result
    }
    func number(_ sql: String,_ args: [Any]=[]) throws -> Int64 { (try rows(sql,args).first?.first as? Int64) ?? 0 }
    func text(_ sql: String,_ args: [Any]=[]) throws -> String { (try rows(sql,args).first?.first as? String) ?? "" }
    func transaction(_ work: () throws -> Void) throws { try run("BEGIN IMMEDIATE");do { try work();try run("COMMIT") } catch { try? run("ROLLBACK");throw error } }
    func metadata(_ e: String) throws -> Data { guard let m=try rows("SELECT metadata FROM downloads WHERE e=?",[e]).first?.first as? Data else { throw CourierError("EVIDENCE_NOT_FOUND") };return m }
    func reopen() throws { try require(sqlite3_close(db)==SQLITE_OK,"SQLITE_CLOSE");db=nil;try open() }
    func conflicts() throws -> Bool { try number("SELECT count(*) FROM (SELECT s FROM downloads GROUP BY s HAVING count(*)>1)")>0 }
    func status(_ e: String) throws -> [String:Any] {
        let m=try metadata(e),s=try text("SELECT s FROM downloads WHERE e=?",[e]);let ack=try text("SELECT ack_status FROM flights WHERE e=?",[e])
        return ["evidence_ref":e,"offset":String(try number("SELECT offset FROM downloads WHERE e=?",[e])),"physical_bytes":String(try EvidenceVerifier.physical(m)),"state":try text("SELECT state FROM downloads WHERE e=?",[e]),"conflict":try number("SELECT count(*) FROM downloads WHERE s=?",[s])>1,"ack_status":ack.isEmpty ? "NONE":ack]
    }
    func read(_ e: String,_ offset: Int64,_ length: Int) throws -> Data {
        try require(length>=1 && length<=16384 && offset>=0 && offset<=0xffffffff && offset+Int64(length)<=number("SELECT offset FROM downloads WHERE e=?",[e]),"READ_RANGE")
        var result=Data();let chunks=try rows("SELECT offset,bytes,sha FROM chunks WHERE e=? AND offset<? AND offset+length(bytes)>? ORDER BY offset",[e,offset+Int64(length),offset])
        for chunk in chunks { let start=chunk[0] as! Int64,b=chunk[1] as! Data,sha=chunk[2] as! String;try require(b.sha==sha,"CHUNK_HASH");let from=max(start,offset),to=min(start+Int64(b.count),offset+Int64(length));try require(from==offset+Int64(result.count),"CHUNK_GAP");result.append(b.part(Int(from-start),Int(to-from))) }
        try require(result.count==length,"CHUNK_GAP");return result
    }
    func verify(_ e: String) throws {
        let m=try metadata(e);try EvidenceVerifier.metadata(m,String(e.suffix(64)));try require(try number("SELECT offset FROM downloads WHERE e=?",[e])==EvidenceVerifier.physical(m),"INCOMPLETE_DOWNLOAD")
        try EvidenceVerifier.verify(m) { o,n in try self.read(e,o,n) }
    }
    func qualification(_ packaged: Bool) throws -> [String:Any] {
        var probe=false,secure=false
        do { try transaction { try run("INSERT OR REPLACE INTO clients(id,bytes) VALUES(?,?)",["__local_probe__",Data([0,1,255,0,42])]) };try reopen();probe=(try rows("SELECT bytes FROM clients WHERE id='__local_probe__'").first?.first as? Data)==Data([0,1,255,0,42]);try transaction { try run("DELETE FROM clients WHERE id='__local_probe__'") } } catch { probe=false }
        do { secure=try credentials.probe() } catch { secure=false }
        var remaining: Int64=0;for row in try rows("SELECT metadata,offset FROM downloads") { remaining += (try EvidenceVerifier.physical(row[0] as! Data))-(row[1] as! Int64) }
        let attrs=try FileManager.default.attributesOfFileSystem(forPath:path.deletingLastPathComponent().path),free=(attrs[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
        let journal=try text("PRAGMA journal_mode"),sync=try number("PRAGMA synchronous")
        let foreignKeys=try number("PRAGMA foreign_keys"),noConflict=try !conflicts()
        let checks:[String:Bool]=["packaged_context":packaged,"recognized_platform":true,"private_sqlite":path.path.contains("/Library/Application Support/FlightCourier/"),"durability_effective":journal.lowercased()=="delete" && sync==3 && foreignKeys==1,"serialized_worker":true,"adequate_storage":free>=remaining+2097152,"probe_reopen_exact":probe,"secure_credentials":secure,"no_conflict":noConflict]
        return ["checks":checks,"journal_mode":journal,"synchronous":sync,"sqlite_version":try text("SELECT sqlite_version()"),"LOCAL_STORAGE_GATE_PASS":checks.values.allSatisfy{$0},"FULL_ACK_GATE_PASS":false,"full_ack_missing":["TLS_TRUST","REAL_PAIRING","DEVICE_TRANSPORT","MOBILE_QUALIFICATION"]]
    }
    func field(_ o: [String:Any],_ key: String) throws -> String { guard let s=o[key] as? String,s.utf8.count<=256 else { throw CourierError("FIELD_LIMIT_"+key) };return s }
    func offset(_ o: [String:Any]) throws -> Int64 { let s=try field(o,"offset");try require(s.range(of:"^(0|[1-9][0-9]*)$",options:.regularExpression) != nil,"OFFSET");guard let n=Int64(s),n<=0xffffffff else { throw CourierError("OFFSET") };return n }
    func decode(_ s: String,_ max: Int) throws -> Data { try require(s.count<=((max+2)/3)*4,"BYTES_LIMIT");guard let b=Data(base64Encoded:s),b.count<=max,b.base64EncodedString()==s else { throw CourierError("BASE64") };return b }
    func dispatch(_ operation: String,_ o: [String:Any],_ packaged: Bool,_ fixtureBuild: Bool) throws -> [String:Any] {
        let fields:[String:[String]]=["evidenceListImported":["after"],"platformInfo":[],"storageQualification":[],"evidenceCreateStaging":["source_device_id","metadata_base64","metadata_sha256"],"evidenceCommitRange":["evidence_ref","offset","bytes_base64"],"evidenceReadRange":["evidence_ref","offset","length"],"credentialStore":["fixture_id"],"credentialExists":["credential_ref"],"credentialDelete":["credential_ref"],"evidenceGetStatus":["evidence_ref"],"evidenceImport":["evidence_ref"],"evidenceReopenVerify":["evidence_ref"],"evidenceCreateAckPending":["evidence_ref"],"evidenceMarkAcked":["evidence_ref"]]
        guard let allowed=fields[operation] else { throw CourierError("UNKNOWN_OPERATION") };try require(o.keys.allSatisfy{allowed.contains($0)},"UNEXPECTED_FIELD");try require(try JSONSerialization.data(withJSONObject:o).count<=24000,"REQUEST_LIMIT")
        if operation=="evidenceListImported" { let after=o["after"] as? String ?? "";try require(after.utf8.count<=256,"FIELD_LIMIT");let rows=try rows("SELECT e FROM flights WHERE e>? ORDER BY e LIMIT 64",[after]);return ["flights":try rows.map { try status($0[0] as! String) },"limit":64] }
        if operation=="storageQualification" { return try qualification(packaged) }
        if operation=="platformInfo" { return ["platform":"ios","packaged_context":packaged,"capacitor_version":"8.5.2","sqlite_implementation":"Apple SQLite3","sqlite_version":try text("SELECT sqlite_version()"),"fixture_build":fixtureBuild,"app_version":Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "unknown","app_build":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "unknown","os_version":ProcessInfo.processInfo.operatingSystemVersionString] }
        if operation.hasPrefix("credential") { let ref: String;if operation=="credentialStore" { try require(fixtureBuild && field(o,"fixture_id")=="courier-v1","PAIRING_NOT_IMPLEMENTED");ref="fixture-"+UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased();try credentials.storeFixture(ref) } else { ref=try field(o,"credential_ref");if operation=="credentialDelete" { try credentials.delete(ref) } };return ["credential_ref":ref,"exists":try credentials.exists(ref),"synthetic":true] }
        if operation=="evidenceCreateStaging" {
            let device=try field(o,"source_device_id"),sha=try field(o,"metadata_sha256");try require(device.range(of:"^[0-9A-F]{2}(:[0-9A-F]{2}){5}$",options:.regularExpression) != nil,"DEVICE_ID")
            let m=try decode(field(o,"metadata_base64"),108);try EvidenceVerifier.metadata(m,sha);let s=device+"|"+m.part(8,16).hex,e=s+"|"+sha
            try transaction { try run("INSERT OR IGNORE INTO downloads(e,s,metadata) VALUES(?,?,?)",[e,s,m]);try require(try metadata(e)==m,"DUPLICATE_METADATA") };return try status(e)
        }
        let e=try field(o,"evidence_ref");try require(e.range(of:"^[0-9A-F]{2}(:[0-9A-F]{2}){5}\\|[0-9a-f]{32}\\|[0-9a-f]{64}$",options:.regularExpression) != nil,"EVIDENCE_REF");let m=try metadata(e)
        if operation=="evidenceGetStatus" { return try status(e) }
        if operation=="evidenceReadRange" { guard let n=o["length"] as? Int,n>=1,n<=16384 else { throw CourierError("READ_RANGE") };return ["bytes_base64":try read(e,offset(o),n).base64EncodedString()] }
        if operation=="evidenceCommitRange" {
            let start=try offset(o);guard let s=o["bytes_base64"] as? String else { throw CourierError("BASE64") };let b=try decode(s,16384),size=try EvidenceVerifier.physical(m);try require(start<size && b.count==Int(min(16384,size-start)),"CHUNK_LENGTH")
            try transaction { try require(try text("SELECT state FROM downloads WHERE e=?",[e])=="STAGING" && number("SELECT offset FROM downloads WHERE e=?",[e])==start,"CONTIGUOUS_OFFSET");try run("INSERT INTO chunks(e,offset,bytes,sha) VALUES(?,?,?,?)",[e,start,b,b.sha]);try run("UPDATE downloads SET offset=? WHERE e=?",[start+Int64(b.count),e]) };return try status(e)
        }
        if operation=="evidenceReopenVerify" { try reopen();try verify(e);var r=try status(e);r["verified"]=true;return r }
        if operation=="evidenceImport" { try verify(e);try transaction { try run("INSERT OR IGNORE INTO flights(e,s) SELECT e,s FROM downloads WHERE e=?",[e]);try run("UPDATE downloads SET state='IMPORTED' WHERE e=?",[e]) };return try status(e) }
        try require(fixtureBuild,"DEVICE_ACK_NOT_IMPLEMENTED");try reopen();try verify(e);try require(try qualification(packaged)["LOCAL_STORAGE_GATE_PASS"] as? Bool==true,"LOCAL_GATE_DENIED");try require(try number("SELECT count(*) FROM flights WHERE e=?",[e])==1,"NOT_IMPORTED")
        if operation=="evidenceCreateAckPending" { try transaction { try run("INSERT OR IGNORE INTO ack_outbox(e,state) VALUES(?,'PENDING_SYNTHETIC')",[e]);try run("UPDATE flights SET ack_status=(SELECT state FROM ack_outbox WHERE e=?) WHERE e=?",[e,e]) } }
        else if operation=="evidenceMarkAcked" { try transaction { try require(try number("SELECT count(*) FROM ack_outbox WHERE e=?",[e])==1,"NO_PENDING_ACK");try run("UPDATE ack_outbox SET state='ACKED_SYNTHETIC' WHERE e=?",[e]);try run("UPDATE flights SET ack_status='ACKED_SYNTHETIC' WHERE e=?",[e]) } }
        else { throw CourierError("UNKNOWN_OPERATION") };return try status(e)
    }
}
