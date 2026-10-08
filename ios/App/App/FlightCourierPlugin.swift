import Foundation
import Capacitor
import UIKit

@objc(FlightCourierPlugin)
public class FlightCourierPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="FlightCourierPlugin"
    public let jsName="FlightCourier"
    public let pluginMethods: [CAPPluginMethod]=[
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
    private func invoke(_ operation: String,_ call: CAPPluginCall) {
        worker.async { do {
            if self.store==nil { self.store=try CourierStore() }
            let configURL=Bundle.main.url(forResource:"capacitor.config",withExtension:"json")
            let config=try configURL.map { try JSONSerialization.jsonObject(with:Data(contentsOf:$0)) as? [String:Any] } ?? nil
            let server=config?["server"] as? [String:Any]
            let packaged=config != nil && server?["url"]==nil
            #if DEBUG
            let fixtureBuild=true
            #else
            let fixtureBuild=false
            #endif
            let result=try self.store!.dispatch(operation,call.options,packaged,fixtureBuild)
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
}
