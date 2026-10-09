import Foundation
import Capacitor
import UIKit

@objc(FlightCourierPlugin)
public class FlightCourierPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="FlightCourierPlugin"
    public let jsName="FlightCourier"
    public let pluginMethods: [CAPPluginMethod]=[
        CAPPluginMethod(name:"courierPairs",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierLocalList",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierPairManual",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierOwnerTransfer",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierConnection",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierList",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierDetail",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierDownload",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierRetryAcks",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"courierCancel",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceListImported",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"platformInfo",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"storageQualification",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceCreateStaging",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceCommitRange",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceGetStatus",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceReadRange",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceImport",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceReopenVerify",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceCreateAckPending",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"evidenceMarkAcked",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"credentialStore",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"credentialExists",returnType:CAPPluginReturnPromise),
        CAPPluginMethod(name:"credentialDelete",returnType:CAPPluginReturnPromise),
    ]
    private let pairFieldDelegate=CourierPairFieldDelegate()
    private let worker=DispatchQueue(label:"is.huginn.courier.sqlite.worker")
    private var store: CourierStore?
    private var network:CourierNetwork?
    private let lifecycleLock=NSLock()
    private var foreground=true
    private var observers=[NSObjectProtocol]()
    private let progressLock=NSLock();private var latestProgress:[String:Any]?;private var progressQueued=false
    public override func load() {
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:nil){ [weak self] _ in self?.setForeground(false) })
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:nil){ [weak self] _ in self?.setForeground(true) })
        setForeground(UIApplication.shared.applicationState == .active)
    }
    private func publishProgress(_ status:[String:Any]) { progressLock.lock();latestProgress=status;if progressQueued { progressLock.unlock();return };progressQueued=true;progressLock.unlock();DispatchQueue.main.async { [weak self] in guard let owner=self else { return };owner.progressLock.lock();let latest=owner.latestProgress;owner.latestProgress=nil;owner.progressQueued=false;owner.progressLock.unlock();if let latest=latest { owner.notifyListeners("courierProgress",data:latest) } } }
    private func setForeground(_ value:Bool) { lifecycleLock.lock();foreground=value;network?.https.setForeground(value);lifecycleLock.unlock() }
    deinit { for o in observers { NotificationCenter.default.removeObserver(o) } }
    private func invoke(_ operation: String,_ call: CAPPluginCall) {
        worker.async { do {
            if self.store==nil { self.store=try CourierStore() }
            self.lifecycleLock.lock();if self.network==nil { self.network=CourierNetwork(self.store!);self.network?.progress={ [weak self] status in self?.publishProgress(status) };self.network?.https.setForeground(self.foreground) };self.lifecycleLock.unlock()
            let configURL=Bundle.main.url(forResource:"capacitor.config",withExtension:"json")
            let config=try configURL.map { try JSONSerialization.jsonObject(with:Data(contentsOf:$0)) as? [String:Any] } ?? nil
            let server=config?["server"] as? [String:Any]
            let packaged=config != nil && server?["url"]==nil
            #if DEBUG
            let fixtureBuild=true
            #else
            let fixtureBuild=false
            #endif
            if operation=="courierPairs" { try CourierWire.keys(call.options,"");let rows=try self.store!.rows("SELECT ref,device,pin,repair FROM courier_pairs ORDER BY device LIMIT 64");let pairs=rows.map { row -> [String:Any] in ["paired_ref":row[0],"source_device_id":row[1],"fingerprint":String((row[2] as! String).prefix(12)),"trust_profile":"DEVELOPMENT","state":(row[3] as! Int64)==1 ? "REPAIR_REQUIRED":"PAIRED_OFFLINE"] };DispatchQueue.main.async { call.resolve(["pairs":pairs]) };return }
            if operation=="courierLocalList" { try CourierWire.keys(call.options,"after");let after=call.getString("after") ?? "";try require(after.utf8.count<=256,"FIELD_LIMIT");let rows=try self.store!.rows("SELECT d.e,r.detail FROM downloads d JOIN courier_remote r ON d.e=r.e WHERE d.e>? ORDER BY d.e LIMIT 16",[after]);let evidence=try rows.map { row -> [String:Any] in var status=try self.store!.status(row[0] as! String);status["metadata"]=try CourierWire.json(Data((row[1] as! String).utf8),2048);return status };DispatchQueue.main.async { call.resolve(["evidence":evidence]) };return }
            if operation=="courierPairManual" { try CourierWire.keys(call.options,"");try require(packaged,"PACKAGED_CONTEXT_REQUIRED");DispatchQueue.main.async { self.pairDialog(call) };return }
            if operation=="courierOwnerTransfer" { try CourierWire.keys(call.options,"paired_ref session_id");try require(packaged,"PACKAGED_CONTEXT_REQUIRED");let ref=try CourierWire.string(call.options,"paired_ref"),id=try CourierWire.string(call.options,"session_id"),m=try self.network!.detail(ref,id);try require(try self.network!.ownerSelectable(m),"OWNER_SELECTION_REQUIRED");DispatchQueue.main.async { self.ownerDialog(call,ref,id,m,packaged) };return }
            let result=try operation.hasPrefix("courier") ? self.network!.dispatch(operation,call.options,packaged):self.store!.dispatch(operation,call.options,packaged,fixtureBuild)
            DispatchQueue.main.async { call.resolve(result) }
        } catch { let code=(error as? CourierError)?.code ?? "LOCAL_STORAGE_FAILURE";DispatchQueue.main.async { call.reject(code) } } }
    }
    @objc func courierPairs(_ call:CAPPluginCall) { invoke("courierPairs",call) }
    @objc func courierLocalList(_ call:CAPPluginCall) { invoke("courierLocalList",call) }
    @objc func courierPairManual(_ call:CAPPluginCall) { invoke("courierPairManual",call) }
    @objc func courierOwnerTransfer(_ call:CAPPluginCall) { invoke("courierOwnerTransfer",call) }
    private func pairDialog(_ call:CAPPluginCall) { let dialog=UIAlertController(title:"Pair / re-pair HuginnEIS",message:"Pairing changes the credential association. Stored evidence and pending acknowledgements are retained.",preferredStyle:.alert);dialog.addTextField { field in field.placeholder="Paste pairing data from HuginnEIS";field.isSecureTextEntry=true;field.delegate=self.pairFieldDelegate;field.autocorrectionType = .no;field.autocapitalizationType = .none;field.textContentType = .none };dialog.addAction(UIAlertAction(title:"Cancel",style:.cancel){ _ in dialog.textFields?.first?.text="";call.reject("CANCELLED") });dialog.addAction(UIAlertAction(title:"Pair",style:.default){ _ in var raw=Data((dialog.textFields?.first?.text ?? "").utf8);dialog.textFields?.first?.text="";self.worker.async { do { try self.network!.https.check(self.network!.https.epoch());try require(raw.count<=4096,"FIELD_LIMIT");let result=try self.network!.intake(&raw);DispatchQueue.main.async { call.resolve(result) } } catch { raw.resetBytes(in:0..<raw.count);DispatchQueue.main.async { call.reject((error as? CourierError)?.code ?? "PAIRING_REQUIRED") } } } });guard let view=self.bridge?.viewController else { call.reject("NATIVE_COURIER_UNAVAILABLE");return };view.present(dialog,animated:true) }
    private func ownerDialog(_ call:CAPPluginCall,_ ref:String,_ id:String,_ m:[String:Any],_ packaged:Bool) { let corrupt=m["state"] as? String=="CORRUPT",sha=m["metadata_sha256"] as! String;let dialog=UIAlertController(title:corrupt ? "Corrupt evidence":"Provisional evidence",message:corrupt ? "This file contains corrupt evidence. The original bytes will be preserved for forensic review.":"This recording did not qualify as a Flight. Transfer provisional evidence anyway?",preferredStyle:.alert);dialog.addAction(UIAlertAction(title:"Cancel",style:.cancel){ _ in call.reject("CANCELLED") });dialog.addAction(UIAlertAction(title:corrupt ? "Transfer forensic evidence":"Transfer evidence",style:.default){ _ in self.worker.async { do { let result=try self.network!.download(ref,id,packaged,sha);DispatchQueue.main.async { call.resolve(result) } } catch { DispatchQueue.main.async { call.reject((error as? CourierError)?.code ?? "LOCAL_STORAGE_FAILURE") } } } });guard let view=self.bridge?.viewController else { call.reject("NATIVE_COURIER_UNAVAILABLE");return };view.present(dialog,animated:true) }
    @objc func platformInfo(_ call: CAPPluginCall) { invoke("platformInfo",call) }
    @objc func storageQualification(_ call: CAPPluginCall) { invoke("storageQualification",call) }
    @objc func evidenceCreateStaging(_ call: CAPPluginCall) { invoke("evidenceCreateStaging",call) }
    @objc func evidenceCommitRange(_ call: CAPPluginCall) { invoke("evidenceCommitRange",call) }
    @objc func evidenceListImported(_ call: CAPPluginCall) { invoke("evidenceListImported",call) }
    @objc func evidenceGetStatus(_ call: CAPPluginCall) { invoke("evidenceGetStatus",call) }
    @objc func evidenceReadRange(_ call: CAPPluginCall) { invoke("evidenceReadRange",call) }
    @objc func evidenceImport(_ call: CAPPluginCall) { invoke("evidenceImport",call) }
    @objc func evidenceReopenVerify(_ call: CAPPluginCall) { invoke("evidenceReopenVerify",call) }
    @objc func evidenceCreateAckPending(_ call: CAPPluginCall) { invoke("evidenceCreateAckPending",call) }
    @objc func evidenceMarkAcked(_ call: CAPPluginCall) { invoke("evidenceMarkAcked",call) }
    @objc func credentialStore(_ call: CAPPluginCall) { invoke("credentialStore",call) }
    @objc func credentialExists(_ call: CAPPluginCall) { invoke("credentialExists",call) }
    @objc func credentialDelete(_ call: CAPPluginCall) { invoke("credentialDelete",call) }
    @objc func courierConnection(_ call:CAPPluginCall) { invoke("courierConnection",call) }
    @objc func courierList(_ call:CAPPluginCall) { invoke("courierList",call) }
    @objc func courierDetail(_ call:CAPPluginCall) { invoke("courierDetail",call) }
    @objc func courierDownload(_ call:CAPPluginCall) { invoke("courierDownload",call) }
    @objc func courierRetryAcks(_ call:CAPPluginCall) { invoke("courierRetryAcks",call) }
    @objc func courierCancel(_ call:CAPPluginCall) { guard call.options.isEmpty else { call.reject("JSON_KEYS");return };lifecycleLock.lock();network?.https.cancel();lifecycleLock.unlock();call.resolve(["state":"CANCELLED"]) }
}

private final class CourierPairFieldDelegate:NSObject,UITextFieldDelegate {
    func textField(_ textField:UITextField,shouldChangeCharactersIn range:NSRange,replacementString string:String)->Bool { guard let text=textField.text,let swiftRange=Range(range,in:text) else { return false };return text.replacingCharacters(in:swiftRange,with:string).utf8.count<=4096 }
}
