package is.huginn.foundation.dev;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name="FlightCourier")
public final class FlightCourierPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();private CourierStore store;
    private void invoke(String operation,PluginCall call){worker.execute(()->{try{if(store==null)store=new CourierStore(getContext());boolean packaged=getBridge().getConfig().getServerUrl()==null;call.resolve(store.dispatch(operation,call.getData(),packaged,BuildConfig.DEBUG));}catch(Exception e){call.reject(e.getMessage()==null?"LOCAL_STORAGE_FAILURE":e.getMessage());}});}
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
}
