package is.huginn.foundation.dev;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState){registerPlugin(FlightCourierPlugin.class);super.onCreate(savedInstanceState);}
}
