package is.huginn.foundation.dev;
import android.content.Context;
import android.os.Build;
import android.webkit.WebView;
import org.json.*;
import java.io.InputStream;
import java.util.*;

/** Only packaged owner qualification records can open the native full gate.
 * No JavaScript eligibility field or test override is accepted. Empty list denies. */
final class CourierQualification {
    static boolean full(Context context,CourierStore store,boolean packaged,boolean tlsAndPermissions)throws Exception {
        if(!BuildConfig.DEBUG||!tlsAndPermissions||!store.qualification(packaged).getBoolean("LOCAL_STORAGE_GATE_PASS"))return false;
        byte[] buffer=new byte[16384];int n=0;try(InputStream in=context.getAssets().open("public/mobile/qualification.json")){while(n<buffer.length){int k=in.read(buffer,n,buffer.length-n);if(k<0)break;n+=k;}if(n==buffer.length)return false;}
        JSONObject manifest=CourierContract.json(Arrays.copyOf(buffer,n),16384);CourierContract.base(manifest,"huginn.flight-courier.mobile-qualification",null);JSONArray rows=manifest.getJSONArray("qualified_builds");
        android.content.pm.PackageInfo webview=WebView.getCurrentWebViewPackage();if(webview==null)return false;
        Map<String,String> actual=new HashMap<>();actual.put("platform","android");actual.put("device_model",Build.MODEL);actual.put("os_version",Build.VERSION.RELEASE);actual.put("app_version",BuildConfig.VERSION_NAME);actual.put("app_build",Integer.toString(BuildConfig.VERSION_CODE));actual.put("capacitor_version","8.5.2");actual.put("webview_version",webview.versionName);actual.put("sqlite_implementation","android.database.sqlite.SQLiteDatabase");actual.put("sqlite_version",store.query("SELECT sqlite_version()"));
        for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);boolean match=true;for(Map.Entry<String,String> a:actual.entrySet())match&=a.getValue().equals(row.opt(a.getKey()));for(String result:Arrays.asList("storage_durability_result","tls_result","permission_result"))match&="PASS".equals(row.opt(result));match&=CourierHttps.PROFILE.equals(row.opt("trust_profile"));if(match)return true;}return false;
    }
}
