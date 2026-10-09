package is.huginn.foundation.dev;

import org.json.*;
import java.nio.*;
import java.nio.charset.*;
import java.math.BigInteger;
import java.util.*;

/** Strict bounded wire contracts; no token or raw evidence bridge values. */
final class CourierContract {
    static final String[] STATES={"","PROVISIONAL","QUALIFIED_OPEN","COMPLETE","INCOMPLETE","CORRUPT"};
    static final Set<String> REASONS=new HashSet<>(Arrays.asList("AMBIGUOUS_SESSION","UNTRUSTED_SESSION","UNSUPPORTED_HFL_VERSION","SOURCE_UNAVAILABLE","ACTIVE_FLIGHT","OWNER_SELECTION_REQUIRED_FORENSIC","OWNER_SELECTION_REQUIRED_PROVISIONAL","AUTOMATIC"));
    // Frozen 3F public error vocabulary. Never echo arbitrary server text.
    static String remoteError(String code){return new HashSet<>(Arrays.asList("ACK_DEFERRED","ACTIVE_FLIGHT","AMBIGUOUS_SESSION","AUTH_REQUIRED","AUTOMATIC","BODY_TOO_LARGE","COMMIT_UNCERTAIN","COMPLETE","CORRUPT","COURIER_BUSY","CURSOR_STALE","EVIDENCE_CHANGED","EVIDENCE_MISMATCH","HFC","HFCM","IF_MATCH_REQUIRED","INCOMPLETE","INVALID_ACK","INVALID_BODY","INVALID_CURSOR","INVALID_IF_MATCH","INVALID_JSON","INVALID_QUERY","INVALID_RANGE","INVALID_REQUEST","INVALID_SESSION_ID","INVALID_TOKEN","IO_FAILED","MEMORY_UNAVAILABLE","METADATA_CHANGED","METHOD_NOT_ALLOWED","NOT_FOUND","NOT_TRANSFERRED","OK","ORIGIN_DENIED","OWNER_SELECTION_REQUIRED_FORENSIC","OWNER_SELECTION_REQUIRED_PROVISIONAL","PROVISIONAL","QUALIFIED_OPEN","RANGE_NOT_SATISFIABLE","RANGE_REQUIRED","RANGE_TOO_LARGE","RECOVERY_PENDING","SD_UNAVAILABLE","SESSION_NOT_FOUND","SOURCE_ID_UNAVAILABLE","SOURCE_UNAVAILABLE","TOKEN_REVOKED","TRANSFERRED","UNSUPPORTED_HFL_VERSION","UNTRUSTED_SESSION")).contains(code)?code:"REMOTE_ERROR";}
    static void need(boolean b,String c){EvidenceVerifier.require(b,c);}
    static String string(JSONObject o,String k)throws Exception {Object x=o.get(k);need(x instanceof String,"JSON_STRING");return (String)x;}
    static boolean bool(JSONObject o,String k)throws Exception {Object x=o.get(k);need(x instanceof Boolean,"JSON_BOOLEAN");return (Boolean)x;}
    static long uint(JSONObject o,String k,long max)throws Exception {Object x=o.get(k);need(x instanceof Integer||x instanceof Long,"JSON_INTEGER");long n=((Number)x).longValue();need(n>=0&&n<=max,"JSON_INTEGER_RANGE");return n;}
    static BigInteger decimal(JSONObject o,String k,boolean signed)throws Exception {String s=string(o,k);need(s.matches(signed?"0|-?[1-9][0-9]*":"0|[1-9][0-9]*"),"DECIMAL");BigInteger n=new BigInteger(s);need(n.compareTo(signed?BigInteger.ONE.shiftLeft(63).negate():BigInteger.ZERO)>=0&&n.compareTo(BigInteger.ONE.shiftLeft(signed?63:64).subtract(BigInteger.ONE))<=0,"DECIMAL_RANGE");return n;}
    static void keys(JSONObject o,String fields)throws Exception {Set<String> want=new HashSet<>(Arrays.asList(fields.split(" ")));need(o.length()==want.size(),"JSON_KEYS");for(Iterator<String> i=o.keys();i.hasNext();)need(want.contains(i.next()),"JSON_KEYS");}
    static void base(JSONObject o,String schema,String device)throws Exception {need(string(o,"schema").equals(schema)&&uint(o,"schema_version",1)==1,"SCHEMA");if(device!=null)need(string(o,"source_device_id").equals(device),"SOURCE_DEVICE_MISMATCH");}
    static void hex(String s,int n,String code){need(s.matches("[0-9a-f]{"+n+"}"),code);}
    // Preflight recursively checks duplicate decoded keys, strict number spelling,
    // nesting and trailing data before platform JSON conversion. Unicode UTF-8 is REPORT.
    static JSONObject json(byte[] b,int max)throws Exception {
        need(b.length<=max,"RESPONSE_LIMIT");String s=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString();
        new Scanner(s).check();return new JSONObject(s);
    }
    private static final class Scanner {
        final String s;int at=0;Scanner(String s){this.s=s;}void ws(){while(at<s.length()&&" \r\n\t".indexOf(s.charAt(at))>=0)at++;}
        void check()throws Exception{ws();need(at<s.length()&&s.charAt(at)=='{',"JSON_OBJECT");value(0);ws();need(at==s.length(),"JSON_TRAILING");}
        void take(char c){ws();need(at<s.length()&&s.charAt(at++)==c,"JSON_SYNTAX");}
        String text()throws Exception {ws();int start=at;take('"');while(at<s.length()){char c=s.charAt(at++);if(c=='"')return new JSONArray("["+s.substring(start,at)+"]").getString(0);need(c>=32,"JSON_STRING");if(c=='\\'){need(at<s.length(),"JSON_ESCAPE");char e=s.charAt(at++);if(e=='u'){need(at+4<=s.length()&&s.substring(at,at+4).matches("[0-9a-fA-F]{4}"),"JSON_ESCAPE");at+=4;}else need("\"\\/bfnrt".indexOf(e)>=0,"JSON_ESCAPE");}}throw new IllegalArgumentException("JSON_STRING");}
        void value(int depth)throws Exception {need(depth<=8,"JSON_DEPTH");ws();need(at<s.length(),"JSON_SYNTAX");char c=s.charAt(at);
            if(c=='{'){at++;ws();Set<String> keys=new HashSet<>();if(at<s.length()&&s.charAt(at)=='}'){at++;return;}while(true){need(keys.add(text()),"JSON_DUPLICATE");take(':');value(depth+1);ws();need(at<s.length(),"JSON_SYNTAX");if(s.charAt(at)=='}'){at++;return;}take(',');}}
            else if(c=='['){at++;ws();if(at<s.length()&&s.charAt(at)==']'){at++;return;}int count=0;while(true){need(++count<=64,"JSON_ARRAY_LIMIT");value(depth+1);ws();need(at<s.length(),"JSON_SYNTAX");if(s.charAt(at)==']'){at++;return;}take(',');}}
            else if(c=='"'){text();}
            else {int start=at;while(at<s.length()&&",]} \t\r\n".indexOf(s.charAt(at))<0)at++;String n=s.substring(start,at);need(n.equals("true")||n.equals("false")||n.equals("null")||n.matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?"),"JSON_SCALAR");}
        }
    }
    static JSONObject pairing(byte[] raw)throws Exception {JSONObject o=json(raw,512);keys(o,"schema schema_version source_device_id tls_spki_sha256 token");base(o,"huginn.flight-courier.pair",null);need(string(o,"source_device_id").matches("[0-9A-F]{2}(:[0-9A-F]{2}){5}"),"DEVICE_ID");hex(string(o,"tls_spki_sha256"),64,"SPKI");String t=string(o,"token");need(t.matches("[A-Za-z0-9_-]{43}"),"PAIR_TOKEN");byte[] decoded=android.util.Base64.decode(t,android.util.Base64.URL_SAFE|android.util.Base64.NO_PADDING|android.util.Base64.NO_WRAP);need(decoded.length==32&&android.util.Base64.encodeToString(decoded,android.util.Base64.URL_SAFE|android.util.Base64.NO_PADDING|android.util.Base64.NO_WRAP).equals(t),"PAIR_TOKEN");Arrays.fill(decoded,(byte)0);return o;}
    static JSONObject metadata(JSONObject o,String device,boolean detail)throws Exception {
        keys(o,"schema schema_version source_device_id manifest_generation session_id filename start_utc state complete integrity record_count valid_bytes runtime_us transfer_state physical_bytes hfl_version eligible reason physical_sha256 metadata_sha256");base(o,"huginn.flight-courier.metadata",device);uint(o,"manifest_generation",0xffffffffL);
        if(!o.isNull("session_id"))hex(string(o,"session_id"),32,"SESSION");else need(!detail,"UNTRUSTED_SESSION");
        need(string(o,"filename").matches("[PF][0-9A-F]{6}\\.FLG"),"FILENAME");decimal(o,"start_utc",true);decimal(o,"runtime_us",false);String state=string(o,"state");need(Arrays.asList(STATES).subList(1,6).contains(state),"STATE");need(bool(o,"complete")==state.equals("COMPLETE"),"COMPLETE");need(uint(o,"integrity",3)>=1,"INTEGRITY");long count=uint(o,"record_count",0xffffffffL),valid=uint(o,"valid_bytes",0xffffffffL);need(valid==128+160*count,"VALID_BYTES");
        if(!o.isNull("physical_bytes"))need(decimal(o,"physical_bytes",false).compareTo(BigInteger.valueOf(valid))>=0,"PHYSICAL_BYTES");else need(!detail,"PHYSICAL_BYTES");
        if(!o.isNull("hfl_version"))need(uint(o,"hfl_version",2)>=1,"HFL_VERSION");else need(!detail,"HFL_VERSION");
        need(Arrays.asList("TRANSFERRED","NOT_TRANSFERRED").contains(string(o,"transfer_state")),"TRANSFER_STATE");String reason=string(o,"reason");need(REASONS.contains(reason)&&bool(o,"eligible")==Arrays.asList("AUTOMATIC","OWNER_SELECTION_REQUIRED_FORENSIC","OWNER_SELECTION_REQUIRED_PROVISIONAL").contains(reason),"ELIGIBILITY");
        for(String h:Arrays.asList("physical_sha256","metadata_sha256")){if(detail)hex(string(o,h),64,"HASH");else need(o.isNull(h),"LIST_HASH");}return o;
    }
    static JSONObject list(byte[] b,String device,int limit)throws Exception {JSONObject o=json(b,16384);keys(o,"schema schema_version source_device_id manifest_generation count capacity entries next_cursor");base(o,"huginn.flight-courier.list",device);long generation=uint(o,"manifest_generation",0xffffffffL),count=uint(o,"count",64);need(uint(o,"capacity",64)==64,"CAPACITY");Object entries=o.get("entries");need(entries instanceof JSONArray,"ENTRIES");JSONArray a=(JSONArray)entries;need(a.length()<=limit&&a.length()<=count,"PAGE_COUNT");for(int i=0;i<a.length();i++){JSONObject m=metadata(a.getJSONObject(i),device,false);need(uint(m,"manifest_generation",0xffffffffL)==generation,"GENERATION");}if(!o.isNull("next_cursor"))need(string(o,"next_cursor").matches("[A-Za-z0-9_-]{38}"),"CURSOR");return o;}
    static boolean automatic(JSONObject m)throws Exception {return bool(m,"eligible")&&string(m,"reason").equals("AUTOMATIC")&&Arrays.asList("COMPLETE","INCOMPLETE").contains(string(m,"state"));}
    static byte[] identity(JSONObject o)throws Exception {byte[] m=new byte[108];ByteBuffer b=ByteBuffer.wrap(m).order(ByteOrder.LITTLE_ENDIAN);b.put(new byte[]{'H','F','C','M'}).putShort((short)1).putShort((short)11);b.put(unhex(string(o,"session_id"))).put(unhex(string(o,"physical_sha256"))).putLong(decimal(o,"physical_bytes",false).longValue()).putLong(decimal(o,"start_utc",true).longValue()).putLong(decimal(o,"runtime_us",false).longValue()).putInt((int)uint(o,"record_count",0xffffffffL)).putInt((int)uint(o,"valid_bytes",0xffffffffL)).put((byte)Arrays.asList(STATES).indexOf(string(o,"state"))).put((byte)uint(o,"integrity",3)).put((byte)(bool(o,"complete")?1:0)).put((byte)uint(o,"hfl_version",2)).put(string(o,"filename").getBytes(StandardCharsets.US_ASCII));EvidenceVerifier.metadata(m,string(o,"metadata_sha256"));return m;}
    static byte[] unhex(String s){byte[] b=new byte[s.length()/2];for(int i=0;i<b.length;i++)b[i]=(byte)Integer.parseInt(s.substring(i*2,i*2+2),16);return b;}
    static String etag(JSONObject m)throws Exception{return "\"hfl-sha256-"+string(m,"physical_sha256")+"-"+string(m,"physical_bytes")+"\"";}
    static JSONObject ack(String device,byte[] m,String sha)throws Exception {JSONObject o=new JSONObject();o.put("schema","huginn.flight-courier.ack");o.put("schema_version",1);o.put("session_id",EvidenceVerifier.hex(Arrays.copyOfRange(m,8,24)));o.put("physical_sha256",EvidenceVerifier.hex(Arrays.copyOfRange(m,24,56)));o.put("physical_bytes",Long.toString(EvidenceVerifier.physical(m)));o.put("metadata_sha256",sha);return o;}
    static void ackResult(byte[] b,JSONObject sent)throws Exception {JSONObject o=json(b,1024);keys(o,"schema schema_version session_id physical_sha256 physical_bytes metadata_sha256 transfer_state manifest_generation already_transferred");base(o,"huginn.flight-courier.ack-result",null);for(String k:Arrays.asList("session_id","physical_sha256","physical_bytes","metadata_sha256"))need(string(o,k).equals(string(sent,k)),"ACK_IDENTITY");need(string(o,"transfer_state").equals("TRANSFERRED"),"ACK_STATE");uint(o,"manifest_generation",0xffffffffL);bool(o,"already_transferred");}
}
