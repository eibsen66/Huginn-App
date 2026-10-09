package is.huginn.foundation.dev;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

// Only ciphertext in no-backup private storage. Token bytes never leave native code.
final class CourierCredentials {
    private final File dir; private static final String ALIAS="huginn.courier.fixture.aes.v1";
    CourierCredentials(Context c){dir=new File(c.getNoBackupFilesDir(),"courier-credentials");EvidenceVerifier.require(dir.isDirectory()||dir.mkdirs(),"CREDENTIAL_DIRECTORY");}
    private File file(String ref){EvidenceVerifier.require(ref.matches("(?:fixture|paired)-[0-9a-f]{32}"),"CREDENTIAL_REF");return new File(dir,ref);}
    private SecretKey key()throws Exception{
        EvidenceVerifier.require(android.os.Build.VERSION.SDK_INT>=28,"UNLOCKED_KEYSTORE_UNSUPPORTED");KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);
        if(!s.containsAlias(ALIAS)){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).setUnlockedDeviceRequired(true).build());g.generateKey();}
        return (SecretKey)s.getKey(ALIAS,null);
    }
    void storeFixture(String ref)throws Exception{storeNative(ref,"SYNTHETIC-COURIER-CREDENTIAL-NOT-A-PAIRING".getBytes(StandardCharsets.UTF_8));}
    // Native-only future pairing seam; never exported to Capacitor. Caller transfers ownership.
    void storeNative(String ref,byte[] token)throws Exception{
        EvidenceVerifier.require(token.length>0&&token.length<=4096,"CREDENTIAL_SIZE");
        try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());byte[] encrypted=c.doFinal(token),iv=c.getIV();
            AtomicFile f=new AtomicFile(file(ref));FileOutputStream out=f.startWrite();
            try{out.write(ByteBuffer.allocate(1+iv.length+encrypted.length).put((byte)iv.length).put(iv).put(encrypted).array());f.finishWrite(out);}catch(Exception e){f.failWrite(out);throw e;}
        }finally{Arrays.fill(token,(byte)0);}
    }
    byte[] readNative(String ref)throws Exception{File f=file(ref);if(!f.exists())return null;EvidenceVerifier.require(f.length()<=4200,"CREDENTIAL_CIPHERTEXT_SIZE");byte[] all=new AtomicFile(f).readFully();EvidenceVerifier.require(all.length>=29&&(all[0]&255)==12,"CREDENTIAL_CIPHERTEXT");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(all,1,13)));return c.doFinal(Arrays.copyOfRange(all,13,all.length));}
    boolean exists(String ref)throws Exception{byte[] token=readNative(ref);if(token==null)return false;try{return token.length>0&&token.length<=4096;}finally{Arrays.fill(token,(byte)0);}}
    void delete(String ref){new AtomicFile(file(ref)).delete();}
    boolean probe()throws Exception{String ref="fixture-00000000000000000000000000000000";try{storeFixture(ref);byte[] token=readNative(ref);try{return Arrays.equals(token,"SYNTHETIC-COURIER-CREDENTIAL-NOT-A-PAIRING".getBytes(StandardCharsets.UTF_8));}finally{if(token!=null)Arrays.fill(token,(byte)0);}}finally{delete(ref);}}
}
