package is.huginn.foundation.dev;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name="FlightCourier")
public final class FlightCourierPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();private CourierStore store;private volatile CourierNetwork network;private volatile boolean foreground=true;private final Object progressLock=new Object();private com.getcapacitor.JSObject latestProgress;private boolean progressQueued;
    private void invoke(String operation,PluginCall call){worker.execute(()->{try{if(store==null)store=new CourierStore(getContext());if(network==null){network=new CourierNetwork(getContext(),store);network.progress=this::progress;network.https.foreground(foreground);}boolean packaged=getBridge().getConfig().getServerUrl()==null;call.resolve(operation.startsWith("courier")?network.dispatch(operation,call.getData(),packaged):store.dispatch(operation,call.getData(),packaged,BuildConfig.DEBUG));}catch(Exception e){call.reject(CourierErrors.publicCode(e));}});}
    @PluginMethod public void platformInfo(PluginCall c){invoke("platformInfo",c);}
    @PluginMethod public void storageQualification(PluginCall c){invoke("storageQualification",c);}
    @PluginMethod public void evidenceCreateStaging(PluginCall c){invoke("evidenceCreateStaging",c);}
    @PluginMethod public void evidenceCommitRange(PluginCall c){invoke("evidenceCommitRange",c);}
    @PluginMethod public void evidenceListImported(PluginCall c){invoke("evidenceListImported",c);}
    @PluginMethod public void evidenceGetStatus(PluginCall c){invoke("evidenceGetStatus",c);}
    @PluginMethod public void evidenceReadRange(PluginCall c){invoke("evidenceReadRange",c);}
    @PluginMethod public void evidenceImport(PluginCall c){invoke("evidenceImport",c);}
    @PluginMethod public void evidenceReopenVerify(PluginCall c){invoke("evidenceReopenVerify",c);}
    @PluginMethod public void evidenceCreateAckPending(PluginCall c){invoke("evidenceCreateAckPending",c);}
    @PluginMethod public void evidenceMarkAcked(PluginCall c){invoke("evidenceMarkAcked",c);}
    @PluginMethod public void credentialStore(PluginCall c){invoke("credentialStore",c);}
    @PluginMethod public void credentialExists(PluginCall c){invoke("credentialExists",c);}
    @PluginMethod public void credentialDelete(PluginCall c){invoke("credentialDelete",c);}

    private void progress(com.getcapacitor.JSObject status){synchronized(progressLock){latestProgress=status;if(progressQueued)return;progressQueued=true;}getActivity().runOnUiThread(()->{com.getcapacitor.JSObject latest;synchronized(progressLock){latest=latestProgress;latestProgress=null;progressQueued=false;}notifyListeners("courierProgress",latest);});}
    @Override protected void handleOnPause(){foreground=false;if(network!=null)network.https.foreground(false);}
    @Override protected void handleOnResume(){foreground=true;if(network!=null)network.https.foreground(true);}
    @Override protected void handleOnDestroy(){foreground=false;if(network!=null)network.https.foreground(false);worker.shutdown();}
    @PluginMethod public void courierConnection(PluginCall c){invoke("courierConnection",c);}
    @PluginMethod public void courierList(PluginCall c){invoke("courierList",c);}
    @PluginMethod public void courierDetail(PluginCall c){invoke("courierDetail",c);}
    @PluginMethod public void courierDownload(PluginCall c){invoke("courierDownload",c);}
    @PluginMethod public void courierRetryAcks(PluginCall c){invoke("courierRetryAcks",c);}
    @PluginMethod public void courierCancel(PluginCall c){if(c.getData().length()!=0){c.reject("JSON_KEYS");return;}if(network!=null)network.https.cancel();com.getcapacitor.JSObject r=new com.getcapacitor.JSObject();r.put("state","CANCELLED");c.resolve(r);}
}
