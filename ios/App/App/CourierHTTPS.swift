import Foundation
import Security

// Fixed endpoint, foreground-only, bounded delegate reads. One request per worker.
// URLSession's delegate queue is separate from the blocking SQLite worker.
final class CourierHTTPS: NSObject, URLSessionDataDelegate {
    static let profile="DEVELOPMENT"
    static let rootSHA="c8e47c813db321f292ef83d087f63620e5f17803de1ab2d26c6551674e247811"
    struct Response { let status:Int;let headers:[String:String];let body:Data;func header(_ k:String)->String? { headers[k.lowercased()] } }
    private let lock=NSLock();private var foreground=true;private var generation=0
    private var task:URLSessionDataTask?;private var session:URLSession?;private var signal:DispatchSemaphore?
    private var response:HTTPURLResponse?;private var body=Data();private var failure:CourierError?;private var cap=0;private var pin=""
    func epoch()->Int { lock.lock();defer { lock.unlock() };return generation }
    func setForeground(_ value:Bool) { lock.lock();foreground=value;if !value { generation+=1;task?.cancel() };lock.unlock() }
    func cancel() { lock.lock();generation+=1;task?.cancel();lock.unlock() }
    func check(_ expected:Int?=nil)throws { lock.lock();defer { lock.unlock() };try require(foreground && (expected==nil || expected==generation),"FOREGROUND_CANCELLED") }
    func request(_ path:String,_ expectedPin:String,_ token:Data,_ post:Data?=nil,_ range:String?=nil,_ etag:String?=nil,_ limit:Int)throws->Response {
        try require(CourierWire.match(path,"/api/v1/flights(?:\\?limit=8(?:&cursor=[A-Za-z0-9_-]{38})?|/[0-9a-f]{32}(?:/evidence|/ack)?)?"),"ENDPOINT");try require(limit>0 && limit<=16384,"BODY_LIMIT")

        #if !DEBUG
        throw CourierError("PRODUCTION_TRUST_NOT_PROVISIONED")
        #else
        let captured=epoch();try check(captured);let config=URLSessionConfiguration.ephemeral
        config.httpCookieStorage=nil;config.httpShouldSetCookies=false;config.urlCache=nil;config.requestCachePolicy = .reloadIgnoringLocalCacheData;config.urlCredentialStorage=nil
        config.connectionProxyDictionary=["HTTPEnable":0,"HTTPSEnable":0,"SOCKSEnable":0,"ProxyAutoConfigEnable":0,"ProxyAutoDiscoveryEnable":0]
        config.timeoutIntervalForRequest=10;config.timeoutIntervalForResource=15;config.httpMaximumConnectionsPerHost=1
        var req=URLRequest(url:URL(string:"https://192.168.4.1"+path)!,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:10);req.httpShouldHandleCookies=false;req.httpMethod=post==nil ? "GET":"POST";req.httpBody=post
        guard let secret=String(data:token,encoding:.ascii) else { throw CourierError("CREDENTIAL_UNAVAILABLE") };req.setValue("Bearer "+secret,forHTTPHeaderField:"Authorization");req.setValue("no-store",forHTTPHeaderField:"Cache-Control");req.setValue("identity",forHTTPHeaderField:"Accept-Encoding");if post != nil { req.setValue("application/json",forHTTPHeaderField:"Content-Type") };if let range=range { req.setValue(range,forHTTPHeaderField:"Range");req.setValue(etag,forHTTPHeaderField:"If-Match") }
        let queue=OperationQueue();queue.maxConcurrentOperationCount=1;let sem=DispatchSemaphore(value:0)
        lock.lock();guard foreground && captured==generation else { lock.unlock();throw CourierError("FOREGROUND_CANCELLED") };cap=limit;pin=expectedPin;body=Data();response=nil;failure=nil;signal=sem
        let s=URLSession(configuration:config,delegate:self,delegateQueue:queue);session=s;let t=s.dataTask(with:req);task=t;t.resume();lock.unlock()
        if sem.wait(timeout:.now()+20) == .timedOut { cancel();s.invalidateAndCancel();lock.lock();session=nil;task=nil;signal=nil;body=Data();lock.unlock();throw CourierError("TRANSPORT_UNAVAILABLE") }
        s.finishTasksAndInvalidate();lock.lock();defer { task=nil;session=nil;signal=nil;body=Data();lock.unlock() }
        try require(foreground && captured==generation,"FOREGROUND_CANCELLED");if let error=failure { throw error };guard let r=response else { throw CourierError("TRANSPORT_UNAVAILABLE") };var headers=[String:String]();for (k,v) in r.allHeaderFields { headers[String(describing:k).lowercased()]=String(describing:v) };return Response(status:r.statusCode,headers:headers,body:body)
        #endif
    }
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void) { lock.lock();if self.session===session { failure=CourierError("REDIRECT_DENIED") };lock.unlock();completionHandler(nil) }
    func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,willCacheResponse proposedResponse:CachedURLResponse,completionHandler:@escaping(CachedURLResponse?)->Void) { completionHandler(nil) }
    func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,didReceive response:URLResponse,completionHandler:@escaping(URLSession.ResponseDisposition)->Void) {
        lock.lock();defer { lock.unlock() };guard self.session===session else { completionHandler(.cancel);return };guard let r=response as? HTTPURLResponse,r.url?.scheme=="https",r.url?.host=="192.168.4.1",!(300..<400).contains(r.statusCode) else { failure=CourierError("REDIRECT_DENIED");completionHandler(.cancel);return }
        let encoding=r.value(forHTTPHeaderField:"Content-Encoding");guard encoding==nil || encoding?.lowercased()=="identity" else { failure=CourierError("CONTENT_ENCODING");completionHandler(.cancel);return };let expectedMedia=r.statusCode==206 ? "application/octet-stream":"application/json";guard r.value(forHTTPHeaderField:"Content-Type")?.split(separator:";").first?.trimmingCharacters(in:.whitespacesAndNewlines).lowercased()==expectedMedia else { failure=CourierError("RESPONSE_MEDIA_TYPE");completionHandler(.cancel);return };let limit=r.statusCode>=400 ? 512:cap;guard let length=r.value(forHTTPHeaderField:"Content-Length"),CourierWire.match(length,"0|[1-9][0-9]*"),let n=Int(length),n<=limit,r.value(forHTTPHeaderField:"Transfer-Encoding")==nil else { failure=CourierError("RESPONSE_LIMIT");completionHandler(.cancel);return };self.response=r;cap=limit;completionHandler(.allow)
    }
    func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,didReceive data:Data) { lock.lock();defer { lock.unlock() };guard self.session===session else { return };if !foreground || data.count>cap-body.count { failure=CourierError("RESPONSE_LIMIT");dataTask.cancel();return };body.append(data) }
    func urlSession(_ session:URLSession,task:URLSessionTask,didCompleteWithError error:Error?) { lock.lock();guard self.session===session else { lock.unlock();return };if error != nil && failure==nil { failure=CourierError("TRANSPORT_UNAVAILABLE") };if error==nil,let r=response,Int(r.value(forHTTPHeaderField:"Content-Length") ?? "") != body.count { failure=CourierError("BODY_LENGTH") };let sem=signal;lock.unlock();sem?.signal() }
    func urlSession(_ session:URLSession,didReceive challenge:URLAuthenticationChallenge,completionHandler:@escaping(URLSession.AuthChallengeDisposition,URLCredential?)->Void) {
        do { try require(challenge.protectionSpace.authenticationMethod==NSURLAuthenticationMethodServerTrust && challenge.protectionSpace.host=="192.168.4.1","TLS_CHALLENGE");guard let trust=challenge.protectionSpace.serverTrust,let url=Bundle.main.url(forResource:"huginn_dev_root_ca",withExtension:"cer",subdirectory:"public/mobile/trust/dev") else { throw CourierError("TRUST_PROFILE") };let rootDER=try Data(contentsOf:url);lock.lock();let expected=pin;lock.unlock();let exact=try Self.checkedTrust(trust,rootDER,expected)
            lock.lock();let allowed=foreground && self.session===session;lock.unlock();try require(allowed && exact==expected,"SPKI_MISMATCH");completionHandler(.useCredential,URLCredential(trust:trust))
        } catch { lock.lock();if self.session===session { failure=(error as? CourierError) ?? CourierError("TLS_TRUST") };lock.unlock();completionHandler(.cancelAuthenticationChallenge,nil) }
    }
    // Native unit seam; exact approved root remains mandatory, no test trust bypass.
    static func checkedTrust(_ trust:SecTrust,_ rootDER:Data,_ pin:String)throws->String {
        try require(rootDER.sha==CourierHTTPS.rootSHA,"TRUST_PROFILE");try require(Date().timeIntervalSince1970>=1788214566 && Date().timeIntervalSince1970<=2103574566,"ROOT_VALIDITY");guard let anchor=SecCertificateCreateWithData(nil,rootDER as CFData) else { throw CourierError("TRUST_PROFILE") }
            try require(SecTrustSetPolicies(trust,SecPolicyCreateSSL(true,"192.168.4.1" as CFString))==errSecSuccess,"TLS_POLICY");try require(SecTrustSetAnchorCertificates(trust,[anchor] as CFArray)==errSecSuccess && SecTrustSetAnchorCertificatesOnly(trust,true)==errSecSuccess,"TLS_ANCHOR");SecTrustSetNetworkFetchAllowed(trust,false)
            var evaluationError:CFError?;try require(SecTrustEvaluateWithError(trust,&evaluationError),"TLS_TRUST");guard let chain=SecTrustCopyCertificateChain(trust) as? [SecCertificate],let leaf=chain.first else { throw CourierError("TLS_CHAIN") };let der=SecCertificateCopyData(leaf) as Data;let hasSAN=der.withUnsafeBytes { raw in huginn_ip_san(raw.bindMemory(to:UInt8.self).baseAddress,der.count) };try require(hasSAN==1,"IP_SAN");let exact=try spki(der).sha
        try require(exact==pin,"SPKI_MISMATCH");return exact
    }
    static func spki(_ der:Data)throws->Data {var offset=0,length=0;let ok=der.withUnsafeBytes { raw in huginn_spki_slice(raw.bindMemory(to:UInt8.self).baseAddress,der.count,&offset,&length) };try require(ok==1,"SPKI_DER");return der.part(offset,length)}
}
