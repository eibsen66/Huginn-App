import Foundation
import Darwin

// Empty or unmatched owner qualification denies. Never takes JS gate/identity fields.
enum CourierQualification {
    static func model()throws->String { var n=0;try require(sysctlbyname("hw.machine",nil,&n,nil,0)==0 && n>0 && n<=256,"DEVICE_MODEL");var b=[CChar](repeating:0,count:n);let rc=b.withUnsafeMutableBytes { sysctlbyname("hw.machine",$0.baseAddress,&n,nil,0) };try require(rc==0,"DEVICE_MODEL");return String(cString:b) }
    static func full(_ store:CourierStore,_ packaged:Bool,_ tlsAndPermissions:Bool)throws->Bool {
        #if !DEBUG
        return false // Final production trust profile is not provisioned.
        #else
        guard tlsAndPermissions,try store.qualification(packaged)["LOCAL_STORAGE_GATE_PASS"] as? Bool==true,let url=Bundle.main.url(forResource:"qualification",withExtension:"json",subdirectory:"public/mobile") else { return false }
        let attributes=try FileManager.default.attributesOfItem(atPath:url.path);guard let size=attributes[.size] as? NSNumber,size.intValue<=16384 else { return false };let m=try CourierWire.json(Data(contentsOf:url),16384);try CourierWire.base(m,"huginn.flight-courier.mobile-qualification");guard let rows=m["qualified_builds"] as? [[String:Any]],!rows.isEmpty else { return false }
        guard let webkit=Bundle(path:"/System/Library/Frameworks/WebKit.framework")?.object(forInfoDictionaryKey:"CFBundleVersion") as? String else { return false }
        let actual=["platform":"ios","device_model":try model(),"os_version":ProcessInfo.processInfo.operatingSystemVersionString,"app_version":Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "unknown","app_build":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "unknown","capacitor_version":"8.5.2","webview_version":webkit,"sqlite_implementation":"Apple SQLite3","sqlite_version":try store.text("SELECT sqlite_version()")]
        for row in rows { var match=actual.allSatisfy { row[$0.key] as? String==$0.value };for key in ["storage_durability_result","tls_result","permission_result"] { match = match && row[key] as? String=="PASS" };match = match && row["trust_profile"] as? String==CourierHTTPS.profile;if match { return true } };return false
        #endif
    }
}
