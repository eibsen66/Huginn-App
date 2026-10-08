package is.huginn.foundation.dev;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Base64;
import com.getcapacitor.JSObject;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

// Owned exclusively by FlightCourierPlugin's one-thread executor.
final class CourierStore {
    private final Context context;private final File path;private SQLiteDatabase db;private final CourierCredentials credentials;
    CourierStore(Context c)throws Exception{context=c;path=new File(c.getNoBackupFilesDir(),"flight-courier-v1.sqlite");credentials=new CourierCredentials(c);open();}
    void open()throws Exception{
        db=SQLiteDatabase.openDatabase(path.getPath(),null,SQLiteDatabase.CREATE_IF_NECESSARY|SQLiteDatabase.NO_LOCALIZED_COLLATORS);
        db.disableWriteAheadLogging();query("PRAGMA journal_mode=DELETE");db.execSQL("PRAGMA synchronous=EXTRA");db.execSQL("PRAGMA foreign_keys=ON");db.execSQL("PRAGMA busy_timeout=5000");
        EvidenceVerifier.require(number("PRAGMA user_version")<=1,"SCHEMA_VERSION");
        String schema;try(java.io.InputStream input=context.getAssets().open("public/mobile/schema.sql");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] buffer=new byte[4096];int n;while((n=input.read(buffer))!=-1)out.write(buffer,0,n);schema=out.toString("UTF-8");}
        transaction(()->{for(String line:schema.split("\n"))if(!line.startsWith("--")&&!line.trim().isEmpty())db.execSQL(line);return null;});
    }
    interface Work<T>{T run()throws Exception;}
    <T>T transaction(Work<T> w)throws Exception{db.execSQL("BEGIN IMMEDIATE");try{T out=w.run();db.execSQL("COMMIT");return out;}catch(Exception e){try{db.execSQL("ROLLBACK");}catch(Exception ignored){}throw e;}}
    String query(String sql,String... args){try(Cursor c=db.rawQuery(sql,args)){return c.moveToFirst()?c.getString(0):null;}}
    long number(String sql,String... args){String s=query(sql,args);return s==null?0:Long.parseLong(s);}
    byte[] metadata(String e){try(Cursor c=db.rawQuery("SELECT metadata FROM downloads WHERE e=?",new String[]{e})){EvidenceVerifier.require(c.moveToFirst(),"EVIDENCE_NOT_FOUND");return c.getBlob(0);}}
    static String text(JSONObject o,String key)throws Exception{String s=o.getString(key);EvidenceVerifier.require(s.length()<=256,"FIELD_LIMIT");return s;}
    static long offset(JSONObject o)throws Exception{String s=text(o,"offset");EvidenceVerifier.require(s.matches("0|[1-9][0-9]*"),"OFFSET");long n=Long.parseLong(s);EvidenceVerifier.require(n<=0xffffffffL,"OFFSET");return n;}
    static byte[] decode(String s,int max){EvidenceVerifier.require(s.length()<=((max+2)/3)*4,"BYTES_LIMIT");byte[] b=Base64.decode(s,Base64.NO_WRAP);EvidenceVerifier.require(b.length<=max&&Base64.encodeToString(b,Base64.NO_WRAP).equals(s),"BASE64");return b;}
    static String key(JSONObject o)throws Exception{String e=text(o,"evidence_ref");EvidenceVerifier.require(e.matches("[0-9A-F]{2}(:[0-9A-F]{2}){5}\\|[0-9a-f]{32}\\|[0-9a-f]{64}"),"EVIDENCE_REF");return e;}
    boolean conflicts(){return number("SELECT count(*) FROM (SELECT s FROM downloads GROUP BY s HAVING count(*)>1)")>0;}
    JSObject status(String e){byte[] m=metadata(e);String s=query("SELECT s FROM downloads WHERE e=?",e);JSObject out=new JSObject();out.put("evidence_ref",e);out.put("offset",query("SELECT offset FROM downloads WHERE e=?",e));out.put("physical_bytes",Long.toString(EvidenceVerifier.physical(m)));out.put("state",query("SELECT state FROM downloads WHERE e=?",e));out.put("conflict",number("SELECT count(*) FROM downloads WHERE s=?",s)>1);String ack=query("SELECT ack_status FROM flights WHERE e=?",e);out.put("ack_status",ack==null?"NONE":ack);return out;}
    byte[] read(String e,long offset,int length)throws Exception{
        EvidenceVerifier.require(length>=1&&length<=16384&&offset>=0&&offset+length<=number("SELECT offset FROM downloads WHERE e=?",e),"READ_RANGE");byte[] result=new byte[length];int written=0;
        try(Cursor c=db.rawQuery("SELECT offset,bytes,sha FROM chunks WHERE e=? AND offset<? AND offset+length(bytes)>? ORDER BY offset",new String[]{e,Long.toString(offset+length),Long.toString(offset)})){
            while(c.moveToNext()){long start=c.getLong(0);byte[] bytes=c.getBlob(1);EvidenceVerifier.require(EvidenceVerifier.hash(bytes).equals(c.getString(2)),"CHUNK_HASH");long from=Math.max(start,offset),to=Math.min(start+bytes.length,offset+length);EvidenceVerifier.require(from==offset+written,"CHUNK_GAP");int n=(int)(to-from);System.arraycopy(bytes,(int)(from-start),result,written,n);written+=n;}
        }EvidenceVerifier.require(written==length,"CHUNK_GAP");return result;
    }
    void verify(String e)throws Exception{
        byte[] m=metadata(e);EvidenceVerifier.metadata(m,e.substring(e.lastIndexOf('|')+1));EvidenceVerifier.require(number("SELECT offset FROM downloads WHERE e=?",e)==EvidenceVerifier.physical(m),"INCOMPLETE_DOWNLOAD");EvidenceVerifier.verify(m,(o,n)->read(e,o,n));
    }
    void reopen()throws Exception{db.close();open();}
    JSObject qualification(boolean packaged)throws Exception{
        boolean probe=false,secure=false;String journal=query("PRAGMA journal_mode");long sync=number("PRAGMA synchronous");
        try{transaction(()->{db.execSQL("INSERT OR REPLACE INTO clients(id,bytes) VALUES(?,?)",new Object[]{"__local_probe__",new byte[]{0,1,(byte)255,0,42}});return null;});reopen();try(Cursor c=db.rawQuery("SELECT bytes FROM clients WHERE id='__local_probe__'",null)){probe=c.moveToFirst()&&Arrays.equals(c.getBlob(0),new byte[]{0,1,(byte)255,0,42});}transaction(()->{db.execSQL("DELETE FROM clients WHERE id='__local_probe__'");return null;});}catch(Exception ignored){probe=false;}
        try{secure=credentials.probe();}catch(Exception ignored){secure=false;}
        long remaining=0;try(Cursor c=db.rawQuery("SELECT metadata,offset FROM downloads",null)){while(c.moveToNext())remaining+=EvidenceVerifier.physical(c.getBlob(0))-c.getLong(1);}
        journal=query("PRAGMA journal_mode");sync=number("PRAGMA synchronous");boolean enough=path.getParentFile().getUsableSpace()>=remaining+2097152;
        JSObject checks=new JSObject();checks.put("packaged_context",packaged);checks.put("recognized_platform",true);checks.put("private_sqlite",path.getCanonicalPath().startsWith(context.getNoBackupFilesDir().getCanonicalPath()+File.separator));checks.put("durability_effective",journal.equalsIgnoreCase("delete")&&sync==3&&number("PRAGMA foreign_keys")==1);checks.put("serialized_worker",true);checks.put("adequate_storage",enough);checks.put("probe_reopen_exact",probe);checks.put("secure_credentials",secure);checks.put("no_conflict",!conflicts());
        boolean pass=true;for(java.util.Iterator<String> it=checks.keys();it.hasNext();)pass&=checks.getBoolean(it.next());JSObject out=new JSObject();out.put("checks",checks);out.put("journal_mode",journal);out.put("synchronous",sync);out.put("sqlite_version",query("SELECT sqlite_version()"));out.put("LOCAL_STORAGE_GATE_PASS",pass);out.put("FULL_ACK_GATE_PASS",false);out.put("full_ack_missing",new String[]{"TLS_TRUST","REAL_PAIRING","DEVICE_TRANSPORT","MOBILE_QUALIFICATION"});return out;
    }
    JSObject dispatch(String operation,JSONObject o,boolean packaged,boolean fixtureBuild)throws Exception{
        EvidenceVerifier.require(o.toString().length()<=24000,"REQUEST_LIMIT");
        java.util.Set<String> allowed=new java.util.HashSet<>();
        switch(operation){case "evidenceCreateStaging":allowed.addAll(Arrays.asList("source_device_id","metadata_base64","metadata_sha256"));break;case "evidenceCommitRange":allowed.addAll(Arrays.asList("evidence_ref","offset","bytes_base64"));break;case "evidenceReadRange":allowed.addAll(Arrays.asList("evidence_ref","offset","length"));break;case "credentialStore":allowed.addAll(Arrays.asList("fixture_id"));break;case "credentialExists":case "credentialDelete":allowed.add("credential_ref");break;case "evidenceGetStatus":case "evidenceImport":case "evidenceReopenVerify":case "evidenceCreateAckPending":case "evidenceMarkAcked":allowed.add("evidence_ref");break;case "evidenceListImported":allowed.add("after");break;case "platformInfo":case "storageQualification":break;default:throw new IllegalArgumentException("UNKNOWN_OPERATION");}
        for(java.util.Iterator<String> it=o.keys();it.hasNext();)EvidenceVerifier.require(allowed.contains(it.next()),"UNEXPECTED_FIELD");
        if(operation.equals("evidenceListImported")){String after=o.optString("after","");EvidenceVerifier.require(after.length()<=256,"FIELD_LIMIT");org.json.JSONArray rows=new org.json.JSONArray();try(Cursor c=db.rawQuery("SELECT e FROM flights WHERE e>? ORDER BY e LIMIT 64",new String[]{after})){while(c.moveToNext())rows.put(status(c.getString(0)));}JSObject r=new JSObject();r.put("flights",rows);r.put("limit",64);return r;}
        if(operation.equals("storageQualification"))return qualification(packaged);
        if(operation.equals("platformInfo")){JSObject r=new JSObject();r.put("platform","android");r.put("os_version",android.os.Build.VERSION.RELEASE);r.put("device_model",android.os.Build.MODEL);r.put("packaged_context",packaged);r.put("capacitor_version","8.5.2");r.put("sqlite_implementation","android.database.sqlite.SQLiteDatabase");r.put("sqlite_version",query("SELECT sqlite_version()"));r.put("app_version",BuildConfig.VERSION_NAME);r.put("app_build",Integer.toString(BuildConfig.VERSION_CODE));r.put("fixture_build",fixtureBuild);return r;}
        if(operation.startsWith("credential")){
            String ref;if(operation.equals("credentialStore")){EvidenceVerifier.require(fixtureBuild&&text(o,"fixture_id").equals("courier-v1"),"PAIRING_NOT_IMPLEMENTED");ref="fixture-"+java.util.UUID.randomUUID().toString().replace("-","");credentials.storeFixture(ref);}else{ref=text(o,"credential_ref");if(operation.equals("credentialDelete"))credentials.delete(ref);}
            JSObject r=new JSObject();r.put("credential_ref",ref);r.put("exists",credentials.exists(ref));r.put("synthetic",true);return r;
        }
        if(operation.equals("evidenceCreateStaging")){
            String device=text(o,"source_device_id"),sha=text(o,"metadata_sha256");EvidenceVerifier.require(device.matches("[0-9A-F]{2}(:[0-9A-F]{2}){5}"),"DEVICE_ID");byte[] m=decode(text(o,"metadata_base64"),108);EvidenceVerifier.metadata(m,sha);String s=device+"|"+EvidenceVerifier.hex(Arrays.copyOfRange(m,8,24)),e=s+"|"+sha;
            transaction(()->{db.execSQL("INSERT OR IGNORE INTO downloads(e,s,metadata) VALUES(?,?,?)",new Object[]{e,s,m});EvidenceVerifier.require(Arrays.equals(metadata(e),m),"DUPLICATE_METADATA");return null;});return status(e);
        }
        String e=key(o);byte[] m=metadata(e);
        if(operation.equals("evidenceGetStatus"))return status(e);
        if(operation.equals("evidenceReadRange")){int n=o.getInt("length");byte[] bytes=read(e,offset(o),n);JSObject r=new JSObject();r.put("bytes_base64",Base64.encodeToString(bytes,Base64.NO_WRAP));return r;}
        if(operation.equals("evidenceCommitRange")){
            long start=offset(o);byte[] b=decode(o.getString("bytes_base64"),16384);long size=EvidenceVerifier.physical(m);EvidenceVerifier.require(start<size&&b.length==Math.min(16384,size-start),"CHUNK_LENGTH");String sha=EvidenceVerifier.hash(b);
            transaction(()->{EvidenceVerifier.require(query("SELECT state FROM downloads WHERE e=?",e).equals("STAGING")&&number("SELECT offset FROM downloads WHERE e=?",e)==start,"CONTIGUOUS_OFFSET");db.execSQL("INSERT INTO chunks(e,offset,bytes,sha) VALUES(?,?,?,?)",new Object[]{e,start,b,sha});db.execSQL("UPDATE downloads SET offset=? WHERE e=?",new Object[]{start+b.length,e});return null;});return status(e);
        }
        if(operation.equals("evidenceReopenVerify")){reopen();verify(e);JSObject r=status(e);r.put("verified",true);return r;}
        if(operation.equals("evidenceImport")){verify(e);transaction(()->{db.execSQL("INSERT OR IGNORE INTO flights(e,s) SELECT e,s FROM downloads WHERE e=?",new Object[]{e});db.execSQL("UPDATE downloads SET state='IMPORTED' WHERE e=?",new Object[]{e});return null;});return status(e);}
        EvidenceVerifier.require(fixtureBuild,"DEVICE_ACK_NOT_IMPLEMENTED");reopen();verify(e);EvidenceVerifier.require(qualification(packaged).getBoolean("LOCAL_STORAGE_GATE_PASS"),"LOCAL_GATE_DENIED");EvidenceVerifier.require(number("SELECT count(*) FROM flights WHERE e=?",e)==1,"NOT_IMPORTED");
        if(operation.equals("evidenceCreateAckPending")){transaction(()->{db.execSQL("INSERT OR IGNORE INTO ack_outbox(e,state) VALUES(?,'PENDING_SYNTHETIC')",new Object[]{e});db.execSQL("UPDATE flights SET ack_status=(SELECT state FROM ack_outbox WHERE e=?) WHERE e=?",new Object[]{e,e});return null;});}
        else if(operation.equals("evidenceMarkAcked")){transaction(()->{EvidenceVerifier.require(number("SELECT count(*) FROM ack_outbox WHERE e=?",e)==1,"NO_PENDING_ACK");db.execSQL("UPDATE ack_outbox SET state='ACKED_SYNTHETIC' WHERE e=?",new Object[]{e});db.execSQL("UPDATE flights SET ack_status='ACKED_SYNTHETIC' WHERE e=?",new Object[]{e});return null;});}
        else throw new IllegalArgumentException("UNKNOWN_OPERATION");return status(e);
    }
}
