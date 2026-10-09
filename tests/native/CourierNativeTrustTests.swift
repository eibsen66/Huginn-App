import XCTest
import Security
@testable import App

// Owner Mac test-target source. No network or real ACK. All fixtures are public.
final class CourierNativeTrustTests:XCTestCase {
    let pin="6cffc99004265d8b768a46b5721c314464f0ccdd6f64596b4086664002b1dcd8"
    func publicDER(_ relative:String)throws->Data { let name=(relative as NSString).lastPathComponent;let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:(name as NSString).deletingPathExtension,withExtension:(name as NSString).pathExtension));let raw=try Data(contentsOf:url);if String(data:raw,encoding:.ascii)?.contains("BEGIN CERTIFICATE")==true { let text=String(data:raw,encoding:.ascii)!.split(separator:"\n").filter{!$0.hasPrefix("-----")}.joined();return Data(base64Encoded:text)! };return raw }
    func root()throws->Data { try publicDER("../../mobile/trust/dev/huginn_dev_root_ca.cer") }
    func leaf()throws->Data { try publicDER("../fixtures/tls/dev-server-public.pem") }
    func trust(_ der:Data)throws->SecTrust { let cert=SecCertificateCreateWithData(nil,der as CFData)!;var t:SecTrust?;XCTAssertEqual(SecTrustCreateWithCertificates([cert] as CFArray,SecPolicyCreateSSL(true,"192.168.4.1" as CFString),&t),errSecSuccess);return t! }
    func testExactDERSPKIAndMatchingChain()throws { XCTAssertEqual(try CourierHTTPS.checkedTrust(trust(leaf()),root(),pin),pin) }
    func testWrongPinDenied()throws { XCTAssertThrowsError(try CourierHTTPS.checkedTrust(trust(leaf()),root(),String(repeating:"0",count:64))) }
    func testUnapprovedAnchorDenied()throws { XCTAssertThrowsError(try CourierHTTPS.checkedTrust(trust(leaf()),leaf(),pin)) }
    func testMissingIPSANDenied()throws { XCTAssertThrowsError(try CourierHTTPS.checkedTrust(trust(root()),root(),pin)) }
    func testExpiredAndNotYetValidLeafDenied()throws { for date in [Date(timeIntervalSince1970:0),Date(timeIntervalSince1970:2200000000)] { let t=try trust(leaf());XCTAssertEqual(SecTrustSetVerifyDate(t,date as CFDate),errSecSuccess);XCTAssertThrowsError(try CourierHTTPS.checkedTrust(t,root(),pin)) } }
    func testDuplicateAndUnknownPairingDenied()throws { for text in ["{\"schema\":1,\"schema\":2}","{\"unknown\":1}"] { XCTAssertThrowsError(try CourierWire.pairing(Data(text.utf8))) } }
    func testTruncatedDERDenied()throws { let d=try leaf();for length in 0..<d.count { XCTAssertThrowsError(try CourierHTTPS.spki(Data(d.prefix(length)))) } }
    func testPlaintextAndArbitraryEndpointDeniedBeforeNetwork()throws { XCTAssertThrowsError(try CourierHTTPS().request("http://192.168.4.1",pin,Data(repeating:0,count:43),nil,nil,nil,16384)) }
    func testRedirectCallbackNeverFollows()throws { let transport=CourierHTTPS(),s=URLSession(configuration:.ephemeral);let task=s.dataTask(with:URL(string:"https://192.168.4.1")!) // Never resumed.
        let response=HTTPURLResponse(url:URL(string:"https://192.168.4.1")!,statusCode:302,httpVersion:"HTTP/1.1",headerFields:["Location":"https://other.invalid"])!;transport.urlSession(s,task:task,willPerformHTTPRedirection:response,newRequest:URLRequest(url:URL(string:"https://other.invalid")!)){ XCTAssertNil($0) };s.invalidateAndCancel()
    }
}
