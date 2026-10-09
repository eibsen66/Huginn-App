package is.huginn.foundation.dev;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;
import java.io.InputStream;
import java.security.cert.*;
import java.util.Date;
import javax.net.ssl.X509TrustManager;

// Owner-run native instrumentation: public certificates only, no network/device ACK.
public final class CourierNativeContractTest {
    private static final String PIN="6cffc99004265d8b768a46b5721c314464f0ccdd6f64596b4086664002b1dcd8";
    private X509Certificate cert(String name,boolean app)throws Exception {try(InputStream in=(app?InstrumentationRegistry.getInstrumentation().getTargetContext():InstrumentationRegistry.getInstrumentation().getContext()).getAssets().open(name)){return (X509Certificate)CertificateFactory.getInstance("X.509").generateCertificate(in);}}
    private X509Certificate root()throws Exception {return cert("public/mobile/trust/dev/huginn_dev_root_ca.cer",true);}
    private X509Certificate leaf()throws Exception {return cert("dev-server-public.pem",false);}
    @Test public void exactSignedSPKI()throws Exception {assertEquals(PIN,EvidenceVerifier.hash(CourierDer.spki(leaf().getEncoded())));}
    @Test public void validChainAndPin()throws Exception {CourierHttps.devTrust(root(),PIN).checkServerTrusted(new X509Certificate[]{leaf()},"RSA");}
    @Test public void wrongPinDenied()throws Exception {try{CourierHttps.devTrust(root(),"0000000000000000000000000000000000000000000000000000000000000000").checkServerTrusted(new X509Certificate[]{leaf()},"RSA");fail();}catch(CertificateException expected){assertEquals("SPKI_MISMATCH",expected.getMessage());}}
    @Test public void unapprovedAnchorDenied()throws Exception {try{CourierHttps.devTrust(leaf(),PIN);fail();}catch(IllegalArgumentException expected){assertEquals("TRUST_PROFILE",expected.getMessage());}}
    @Test public void explicitSANRequired()throws Exception {try{CourierHttps.fixedIP(root());fail();}catch(CertificateException expected){assertEquals("IP_SAN",expected.getMessage());}}
    @Test public void validityRejectedOutsideDates()throws Exception {for(Date at:new Date[]{new Date(leaf().getNotBefore().getTime()-1),new Date(leaf().getNotAfter().getTime()+1)}){try{leaf().checkValidity(at);fail();}catch(CertificateException expected){}}}
    @Test public void duplicateAndUnknownPairingDenied()throws Exception {for(String s:new String[]{"{\"schema\":1,\"schema\":2}","{\"unknown\":1}"}){try{CourierContract.pairing(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));fail();}catch(Exception expected){}}}
    @Test public void truncatedDERDenied()throws Exception {byte[] der=leaf().getEncoded();for(int i=0;i<der.length;i++){try{CourierDer.spki(java.util.Arrays.copyOf(der,i));fail();}catch(IllegalArgumentException expected){}}}
    @Test public void plaintextOrArbitraryEndpointDeniedBeforeNetwork()throws Exception {CourierHttps h=new CourierHttps(InstrumentationRegistry.getInstrumentation().getTargetContext());try{h.request("http://192.168.4.1",PIN,new byte[43],null,null,null,16384);fail();}catch(IllegalArgumentException expected){assertEquals("ENDPOINT",expected.getMessage());}}
    @Test public void redirectDeniedBeforeBodyRead()throws Exception {try{CourierHttps.decode(new java.io.ByteArrayInputStream("HTTP/1.1 302 Found\r\nContent-Length: 0\r\n\r\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII)),16384);fail();}catch(IllegalArgumentException expected){assertEquals("REDIRECT_DENIED",expected.getMessage());}}
    @Test public void responseCapsEnforcedBeforeAllocation()throws Exception {for(int[] c:new int[][]{{200,16385,16384},{200,2049,2048},{200,1025,1024},{400,513,16384}}){String response="HTTP/1.1 "+c[0]+" Test\r\nContent-Length: "+c[1]+"\r\n\r\n";try{CourierHttps.decode(new java.io.ByteArrayInputStream(response.getBytes(java.nio.charset.StandardCharsets.US_ASCII)),c[2]);fail();}catch(IllegalArgumentException expected){assertEquals("RESPONSE_LIMIT",expected.getMessage());}}}
}
