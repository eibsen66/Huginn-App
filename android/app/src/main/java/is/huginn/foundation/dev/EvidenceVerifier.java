package is.huginn.foundation.dev;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.zip.CRC32;

// Native streaming verification. No whole evidence allocation, no floating-point identities.
final class EvidenceVerifier {
    interface Reader { byte[] read(long offset,int length) throws Exception; }
    static void require(boolean ok,String code) { if(!ok)throw new IllegalArgumentException(code); }
    static String hex(byte[] b){StringBuilder s=new StringBuilder();for(byte v:b)s.append(String.format("%02x",v&255));return s.toString();}
    static String hash(byte[] b)throws Exception{return hex(MessageDigest.getInstance("SHA-256").digest(b));}
    static ByteBuffer view(byte[] b){return ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN);}
    static long crc(byte[] b,int n){CRC32 c=new CRC32();c.update(b,0,n);return c.getValue();}
    static long physical(byte[] m){long n=view(m).getLong(56);require(n>=128&&n<=0xffffffffL,"UNSUPPORTED_LOCAL_SIZE");return n;}
    static void metadata(byte[] m,String digest)throws Exception{
        require(m.length==108,"METADATA_SIZE");ByteBuffer d=view(m);
        require(new String(m,0,4,StandardCharsets.US_ASCII).equals("HFCM")&&d.getShort(4)==1&&d.getShort(6)==11,"METADATA_FORMAT");
        require(new String(m,92,11,StandardCharsets.US_ASCII).matches("[PF][0-9A-F]{6}\\.FLG"),"FILENAME");
        for(int i=103;i<108;i++)require(m[i]==0,"METADATA_PADDING");
        require(m[88]>=1&&m[88]<=5&&m[89]>=1&&m[89]<=3&&(m[91]==1||m[91]==2)&&m[90]==(m[88]==3?1:0),"METADATA_ENUM");
        require(Integer.toUnsignedLong(d.getInt(84))==128+160*Integer.toUnsignedLong(d.getInt(80))&&Integer.toUnsignedLong(d.getInt(84))<=physical(m),"TRUST_BOUNDARY");
        require(digest.matches("[0-9a-f]{64}")&&hash(m).equals(digest),"METADATA_HASH");
    }
    static void verify(byte[] m,Reader reader)throws Exception{
        long size=physical(m);MessageDigest digest=MessageDigest.getInstance("SHA-256");
        for(long o=0;o<size;o+=16384)digest.update(reader.read(o,(int)Math.min(16384,size-o)));
        require(hex(digest.digest()).equals(hex(Arrays.copyOfRange(m,24,56))),"PHYSICAL_HASH");
        byte[] h=reader.read(0,128);ByteBuffer hd=view(h),md=view(m);
        require(new String(h,0,4,StandardCharsets.US_ASCII).equals("HFL1")&&(h[4]==1||h[4]==2)&&(h[5]&255)==128&&Integer.toUnsignedLong(hd.getInt(124))==crc(h,124),"HEADER");
        require(Arrays.equals(Arrays.copyOfRange(h,8,24),Arrays.copyOfRange(m,8,24))&&h[4]==m[91]&&hd.getLong(32)==md.getLong(64),"HEADER_METADATA");
        long offset=128,count=0,expected=1,last=0,start=0,runtime=0;int integrity=1;
        boolean complete=false,qualified=false,running=false,lost=false,haveLast=false;
        while(offset<size){
            if(size-offset<160){integrity=2;break;}
            byte[] r=reader.read(offset,160);ByteBuffer d=view(r);int type=r[4]&255;
            if(Integer.toUnsignedLong(d.getInt(156))!=crc(r,156)||type<1||type>10){integrity=3;break;}
            long seq=Integer.toUnsignedLong(d.getInt(0)),at=d.getLong(8);
            require(seq==expected&&(!haveLast||Long.compareUnsigned(at,last)>=0),"RECORD_SEQUENCE");expected=seq+1;last=at;haveLast=true;count++;offset+=160;
            if(type==5)qualified=true;
            if(type==2||type==3||type==8){if(!running){running=true;start=at;}}
            else if(type==4||type==6){if(running&&!lost&&Long.compareUnsigned(at,start)>=0)runtime=add(runtime,at-start);running=false;lost=type==6;}
            else if(type==7)lost=false;
            else if(type==1&&(r[124]&255)==1){int rpm=d.getInt(24);if(lost)lost=false;if(rpm>=700000&&!running){running=true;start=at;}else if(rpm<700000&&running){if(!lost&&Long.compareUnsigned(at,start)>=0)runtime=add(runtime,at-start);running=false;}}
            else if(type==1){if(running&&!lost&&Long.compareUnsigned(at,start)>=0)runtime=add(runtime,at-start);running=false;lost=true;}
            else if(type==10){if(running&&!lost&&Long.compareUnsigned(at,start)>=0)runtime=add(runtime,at-start);running=false;complete=true;if(h[4]==1){if(offset<size)integrity=3;break;}}
        }
        if(!complete&&running&&!lost&&haveLast&&Long.compareUnsigned(last,start)>=0)runtime=add(runtime,last-start);
        int state=integrity==3?5:complete?3:qualified?4:1;
        require(count==Integer.toUnsignedLong(md.getInt(80))&&offset==Integer.toUnsignedLong(md.getInt(84))&&integrity==(m[89]&255)&&state==(m[88]&255)&&(integrity!=3&&complete)==(m[90]==1)&&(qualified?runtime:0)==md.getLong(72),"PARSED_METADATA");
        require(m[88]!=2,"ACTIVE_FLIGHT");
    }
    static long add(long a,long b){long c=a+b;require(Long.compareUnsigned(c,a)>=0,"RUNTIME_OVERFLOW");return c;}
}
