import Foundation
import Capacitor
import UIKit

@objc(FlightCourierPlugin)
public class FlightCourierPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="FlightCourierPlugin"
    public let jsName="FlightCourier"
    public let pluginMethods: [CAPPluginMethod]=[
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
            let result=try operation.hasPrefix("courier") ? self.network!.dispatch(operation,call.options,packaged):self.store!.dispatch(operation,call.options,packaged,fixtureBuild)
            DispatchQueue.main.async { call.resolve(result) }
        } catch { let code=(error as? CourierError)?.code ?? "LOCAL_STORAGE_FAILURE";DispatchQueue.main.async { call.reject(code) } } }
    }
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
