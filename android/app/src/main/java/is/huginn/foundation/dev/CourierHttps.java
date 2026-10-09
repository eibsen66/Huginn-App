package is.huginn.foundation.dev;
import android.content.Context;
import android.net.*;
import java.net.*;
import java.io.*;
import java.security.*;
import java.security.cert.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.net.ssl.*;

/** Endpoint-only HTTP/1.1 over a network-scoped TLS socket. No URL bridge,
 * HTTP fallback, HTTP proxy, CookieHandler, response cache, or redirects. */
final class CourierHttps {
    static final String ROOT_SHA="c8e47c813db321f292ef83d087f63620e5f17803de1ab2d26c6551674e247811";
    static final String PROFILE="DEVELOPMENT"; // Future PRODUCTION profile must provision its own anchor; no fallback.
    final Context context;private final Object lifecycle=new Object();private boolean foreground=true;private volatile int generation=0;private Socket active;
    CourierHttps(Context c){context=c;}
    void foreground(boolean value){synchronized(lifecycle){foreground=value;if(!value)generation++;if(!value&&active!=null)try{active.close();}catch(IOException ignored){}}}
    void cancel(){synchronized(lifecycle){generation++;if(active!=null)try{active.close();}catch(IOException ignored){}}}
    int epoch(){return generation;}
    void check(int epoch){requireForeground();CourierContract.need(epoch==generation,"FOREGROUND_CANCELLED");}
    void requireForeground(){synchronized(lifecycle){CourierContract.need(foreground,"FOREGROUND_REQUIRED");}}
    Network wifi()throws Exception {try{ConnectivityManager cm=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);Network found=null;
        for(Network n:cm.getAllNetworks()){NetworkCapabilities c=cm.getNetworkCapabilities(n);LinkProperties l=cm.getLinkProperties(n);if(c==null||l==null||!c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))continue;boolean huginn=false;for(LinkAddress a:l.getLinkAddresses()){byte[] ip=a.getAddress().getAddress();if(ip.length==4&&(ip[0]&255)==192&&(ip[1]&255)==168&&(ip[2]&255)==4)huginn=true;}if(huginn){CourierContract.need(found==null,"WIFI_AMBIGUOUS");found=n;}}
        CourierContract.need(found!=null,"TRANSPORT_UNAVAILABLE");return found;}catch(SecurityException denied){throw new IllegalArgumentException("LOCAL_NETWORK_DENIED");}
    }
    SSLSocketFactory tls(String pin)throws Exception {CourierContract.need(BuildConfig.DEBUG,"PRODUCTION_TRUST_NOT_PROVISIONED");X509Certificate root;try(InputStream in=context.getAssets().open("public/mobile/trust/dev/huginn_dev_root_ca.cer")){root=(X509Certificate)CertificateFactory.getInstance("X.509").generateCertificate(in);}SSLContext ssl=SSLContext.getInstance("TLS");ssl.init(null,new TrustManager[]{devTrust(root,pin)},null);return ssl.getSocketFactory();}
    // Native unit seam: validates only the fixed approved public DEV root, never trust-all.
    static X509TrustManager devTrust(X509Certificate root,String pin)throws Exception {CourierContract.need(EvidenceVerifier.hash(root.getEncoded()).equals(ROOT_SHA)&&root.getBasicConstraints()>=0,"TRUST_PROFILE");root.checkValidity();
        KeyStore anchors=KeyStore.getInstance(KeyStore.getDefaultType());anchors.load(null,null);anchors.setCertificateEntry("approved-huginn-dev",root);TrustManagerFactory factory=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());factory.init(anchors);X509TrustManager delegate=null;for(TrustManager t:factory.getTrustManagers())if(t instanceof X509TrustManager)delegate=(X509TrustManager)t;final X509TrustManager trust=delegate;CourierContract.need(trust!=null,"TRUST_PROFILE");
        X509TrustManager bound=new X509TrustManager(){public X509Certificate[] getAcceptedIssuers(){return trust.getAcceptedIssuers();}public void checkClientTrusted(X509Certificate[] c,String a)throws CertificateException{throw new CertificateException("CLIENT_AUTH_DENIED");}public void checkServerTrusted(X509Certificate[] chain,String auth)throws CertificateException{trust.checkServerTrusted(chain,auth);for(X509Certificate cert:chain)cert.checkValidity();X509Certificate leaf=chain[0];fixedIP(leaf);try{if(!"X.509".equals(leaf.getPublicKey().getFormat())||!EvidenceVerifier.hash(CourierDer.spki(leaf.getEncoded())).equals(pin))throw new CertificateException("SPKI_MISMATCH");}catch(CertificateException e){throw e;}catch(Exception e){throw new CertificateException("SPKI_MISMATCH");}}};
        return bound;
    }
    static void fixedIP(X509Certificate leaf)throws CertificateException{boolean ip=false;Collection<List<?>> sans=leaf.getSubjectAlternativeNames();if(sans!=null)for(List<?> s:sans)if(Integer.valueOf(7).equals(s.get(0))&&"192.168.4.1".equals(s.get(1)))ip=true;if(!ip)throw new CertificateException("IP_SAN");}
    static final class Response {int status;Map<String,String> headers=new HashMap<>();byte[] body;String header(String k){return headers.get(k.toLowerCase(Locale.ROOT));}}
    Response request(String path,String pin,byte[] token,byte[] post,String range,String etag,int max)throws Exception {
        CourierContract.need(path.matches("/api/v1/flights(?:\\?limit=8(?:&cursor=[A-Za-z0-9_-]{38})?|/[0-9a-f]{32}(?:/evidence|/ack)?)?"),"ENDPOINT");CourierContract.need(max>=1&&max<=16384,"BODY_LIMIT");SSLSocketFactory ssl=tls(pin);Socket base;SSLSocket socket;
        synchronized(lifecycle){CourierContract.need(foreground,"FOREGROUND_REQUIRED");base=wifi().getSocketFactory().createSocket();active=base;}
        try {base.connect(new InetSocketAddress("192.168.4.1",443),10000);socket=(SSLSocket)ssl.createSocket(base,"192.168.4.1",443,true);synchronized(lifecycle){CourierContract.need(foreground,"FOREGROUND_REQUIRED");active=socket;}socket.setSoTimeout(10000);SSLParameters parameters=socket.getSSLParameters();parameters.setEndpointIdentificationAlgorithm("HTTPS");socket.setSSLParameters(parameters);socket.startHandshake();
            synchronized(lifecycle){CourierContract.need(foreground,"FOREGROUND_REQUIRED");OutputStream out=socket.getOutputStream();out.write(((post==null?"GET ":"POST ")+path+" HTTP/1.1\r\nHost: 192.168.4.1\r\nConnection: close\r\nCache-Control: no-store\r\nAccept-Encoding: identity\r\nAuthorization: Bearer ").getBytes(StandardCharsets.US_ASCII));out.write(token);out.write("\r\n".getBytes(StandardCharsets.US_ASCII));if(range!=null)out.write(("Range: "+range+"\r\nIf-Match: "+etag+"\r\n").getBytes(StandardCharsets.US_ASCII));if(post!=null)out.write(("Content-Type: application/json\r\nContent-Length: "+post.length+"\r\n").getBytes(StandardCharsets.US_ASCII));out.write("\r\n".getBytes(StandardCharsets.US_ASCII));if(post!=null)out.write(post);out.flush();}
            Response r=decode(socket.getInputStream(),max);String media=r.header("content-type");CourierContract.need(media!=null&&media.split(";",2)[0].trim().equalsIgnoreCase(r.status==206?"application/octet-stream":"application/json"),"RESPONSE_MEDIA_TYPE");requireForeground();return r;
        }catch(javax.net.ssl.SSLException invalid){throw new IllegalArgumentException("TLS_TRUST");}catch(IOException unavailable){throw new IllegalArgumentException("TRANSPORT_UNAVAILABLE");}finally{try{base.close();}catch(IOException ignored){}synchronized(lifecycle){active=null;}}
    }
    static Response decode(InputStream in,int max)throws Exception {Response r=new Response();int[] budget={8192};String status=line(in,budget);CourierContract.need(status.matches("HTTP/1\\.[01] [0-9]{3}(?: .*)?"),"HTTP_STATUS");r.status=Integer.parseInt(status.substring(9,12));CourierContract.need(r.status<300||r.status>=400,"REDIRECT_DENIED");String line;int count=0;while(!(line=line(in,budget)).isEmpty()){CourierContract.need(++count<=32,"HEADER_LIMIT");int colon=line.indexOf(':');CourierContract.need(colon>0,"HTTP_HEADER");String key=line.substring(0,colon).toLowerCase(Locale.ROOT),value=line.substring(colon+1).trim();CourierContract.need(!r.headers.containsKey(key),"DUPLICATE_HEADER");r.headers.put(key,value);}
            CourierContract.need(!r.headers.containsKey("transfer-encoding"),"HTTP_FRAMING");CourierContract.need(r.header("content-encoding")==null||"identity".equalsIgnoreCase(r.header("content-encoding")),"CONTENT_ENCODING");String length=r.header("content-length");CourierContract.need(length!=null&&length.matches("0|[1-9][0-9]*")&&length.length()<=5,"CONTENT_LENGTH");int n=Integer.parseInt(length),cap=r.status>=400?512:max;CourierContract.need(n<=cap,"RESPONSE_LIMIT");r.body=new byte[n];int at=0;while(at<n){int got=in.read(r.body,at,n-at);CourierContract.need(got>0,"BODY_TRUNCATED");at+=got;}return r;}
    private static String line(InputStream in,int[] remaining)throws Exception {StringBuilder b=new StringBuilder();while(true){CourierContract.need(--remaining[0]>=0,"HEADER_LIMIT");int c=in.read();CourierContract.need(c>=0&&c<=127,"HTTP_HEADER");if(c==13){CourierContract.need(--remaining[0]>=0&&in.read()==10,"HTTP_HEADER");return b.toString();}CourierContract.need(c>=32&&c!=127,"HTTP_HEADER");b.append((char)c);}}
}
