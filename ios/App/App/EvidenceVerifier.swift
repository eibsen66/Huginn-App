import Foundation
import CryptoKit

struct CourierError: Error { let code: String; init(_ code: String) { self.code=code } }
func require(_ ok: Bool,_ code: String) throws { if !ok { throw CourierError(code) } }
extension Data {
    var hex: String { map { String(format:"%02x",$0) }.joined() }
    var sha: String { Data(SHA256.hash(data:self)).hex }
    func u(_ offset: Int,_ count: Int) -> UInt64 { (0..<count).reduce(0) { $0 | (UInt64(self[offset+$1]) << ($1*8)) } }
    func part(_ start: Int,_ count: Int) -> Data { Data(self[start..<start+count]) }
}
enum EvidenceVerifier {
    static func crc(_ d: Data,_ n: Int) -> UInt64 { var c: UInt32=0xffffffff; for b in d.prefix(n) { c ^= UInt32(b);for _ in 0..<8 { c=(c>>1) ^ ((c&1) != 0 ? 0xedb88320:0) } };return UInt64(~c) }
    static func physical(_ m: Data) throws -> Int64 { try require(m.count==108,"METADATA_SIZE");let n=m.u(56,8);try require(n>=128 && n<=0xffffffff,"UNSUPPORTED_LOCAL_SIZE");return Int64(n) }
    static func metadata(_ m: Data,_ digest: String) throws {
        try require(m.count==108,"METADATA_SIZE");try require(String(data:m.part(0,4),encoding:.ascii)=="HFCM" && m.u(4,2)==1 && m.u(6,2)==11,"METADATA_FORMAT")
        let filename=String(data:m.part(92,11),encoding:.ascii) ?? ""
        try require(filename.range(of:"^[PF][0-9A-F]{6}\\.FLG$",options:.regularExpression) != nil && m.suffix(5).allSatisfy{$0==0},"FILENAME_PADDING")
        try require((1...5).contains(m[88]) && (1...3).contains(m[89]) && (m[91]==1 || m[91]==2) && m[90]==(m[88]==3 ? 1:0),"METADATA_ENUM")
        let size=try physical(m);try require(m.u(84,4)==128+160*m.u(80,4) && m.u(84,4)<=UInt64(size),"TRUST_BOUNDARY");try require(digest.count==64 && digest.allSatisfy{"0123456789abcdef".contains($0)} && m.sha==digest,"METADATA_HASH")
    }
    static func verify(_ m: Data,_ read: (Int64,Int) throws -> Data) throws {
        let size=try physical(m);var hasher=SHA256();var o: Int64=0
        while o<size { let n=Int(min(16384,size-o));let b=try read(o,n);try require(b.count==n,"CHUNK_READ");hasher.update(data:b);o+=Int64(n) }
        try require(Data(hasher.finalize()).hex==m.part(24,32).hex,"PHYSICAL_HASH")
        let h=try read(0,128);try require(h.count==128,"HEADER_SIZE")
        try require(String(data:h.part(0,4),encoding:.ascii)=="HFL1" && (h[4]==1 || h[4]==2) && h[5]==128 && h.u(124,4)==crc(h,124),"HEADER")
        try require(h.part(8,16)==m.part(8,16) && h[4]==m[91] && h.u(32,8)==m.u(64,8),"HEADER_METADATA")
        var offset: Int64=128,count: UInt64=0,expected: UInt64=1,last: UInt64=0,start: UInt64=0,runtime: UInt64=0,integrity: UInt8=1
        var complete=false,qualified=false,running=false,lost=false,haveLast=false
        func add(_ a: UInt64,_ b: UInt64) throws -> UInt64 { let (v,overflow)=a.addingReportingOverflow(b);try require(!overflow,"RUNTIME_OVERFLOW");return v }
        while offset<size {
            if size-offset<160 { integrity=2;break }
            let r=try read(offset,160);try require(r.count==160,"CHUNK_READ");let type=r[4]
            if r.u(156,4) != crc(r,156) || type<1 || type>10 { integrity=3;break }
            let seq=r.u(0,4),at=r.u(8,8);try require(seq==expected && (!haveLast || at>=last),"RECORD_SEQUENCE");expected=seq+1;last=at;haveLast=true;count+=1;offset+=160
            if type==5 { qualified=true }
            if type==2 || type==3 || type==8 { if !running { running=true;start=at } }
            else if type==4 || type==6 { if running && !lost && at>=start { runtime=try add(runtime,at-start) };running=false;lost=type==6 }
            else if type==7 { lost=false }
            else if type==1 && r[124]==1 { let rpm=Int32(bitPattern:UInt32(r.u(24,4)));if lost { lost=false };if rpm>=700000 && !running { running=true;start=at } else if rpm<700000 && running { if !lost && at>=start { runtime=try add(runtime,at-start) };running=false } }
            else if type==1 { if running && !lost && at>=start { runtime=try add(runtime,at-start) };running=false;lost=true }
            else if type==10 { if running && !lost && at>=start { runtime=try add(runtime,at-start) };running=false;complete=true;if h[4]==1 { if offset<size { integrity=3 };break } }
        }
        if !complete && running && !lost && haveLast && last>=start { runtime=try add(runtime,last-start) }
        let state: UInt8=integrity==3 ? 5:complete ? 3:qualified ? 4:1
        try require(count==m.u(80,4) && UInt64(offset)==m.u(84,4) && integrity==m[89] && state==m[88] && (integrity != 3 && complete)==(m[90]==1) && (qualified ? runtime:0)==m.u(72,8),"PARSED_METADATA");try require(m[88] != 2,"ACTIVE_FLIGHT")
    }
}
