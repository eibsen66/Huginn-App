package is.huginn.foundation.dev;
import java.util.Arrays;

/** Exact slice of signed X.509 DER, not PublicKey re-encoding. Same bounded
 * TLV walk as CourierSPKI.c, with overflow/nonminimal length rejection. */
final class CourierDer {
    private static final class Item {int tag,content,end,kind;}
    private static Item tlv(byte[] d,int cap,int at){CourierContract.need(at>=0&&cap<=d.length&&cap-at>=2,"SPKI_DER");Item x=new Item();x.tag=at;x.kind=d[at++]&255;CourierContract.need((x.kind&31)!=31,"SPKI_DER");int n=d[at++]&255;if((n&128)!=0){int k=n&127;n=0;CourierContract.need(k>=1&&k<=4&&k<=cap-at&&d[at]!=0,"SPKI_DER");for(int i=0;i<k;i++){CourierContract.need(n<=Integer.MAX_VALUE/256,"SPKI_DER");n=n*256+(d[at++]&255);}CourierContract.need(n>=128,"SPKI_DER");}CourierContract.need(n<=cap-at,"SPKI_DER");x.content=at;x.end=at+n;return x;}
    static byte[] spki(byte[] d){CourierContract.need(d.length<=16384,"SPKI_DER");Item cert=tlv(d,d.length,0);CourierContract.need(cert.kind==48&&cert.end==d.length,"SPKI_DER");Item tbs=tlv(d,cert.end,cert.content);CourierContract.need(tbs.kind==48,"SPKI_DER");int at=tbs.content;Item x=tlv(d,tbs.end,at);if(x.kind==160){Item version=tlv(d,x.end,x.content);CourierContract.need(version.kind==2&&version.end==x.end,"SPKI_DER");at=x.end;}for(int kind:new int[]{2,48,48,48,48}){x=tlv(d,tbs.end,at);CourierContract.need(x.kind==kind,"SPKI_DER");at=x.end;}x=tlv(d,tbs.end,at);CourierContract.need(x.kind==48,"SPKI_DER");Item alg=tlv(d,x.end,x.content),key=tlv(d,x.end,alg.end);CourierContract.need(alg.kind==48&&key.kind==3&&key.end==x.end&&key.content<key.end&&(d[key.content]&255)<=7,"SPKI_DER");return Arrays.copyOfRange(d,x.tag,x.end);}
}
