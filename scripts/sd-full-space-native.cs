using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.ComponentModel;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

public sealed class SdFileResult {
    public long Bytes; public string Sha256; public double Seconds;
}
public static class SdFullSpaceNative {
    const int Chunk=4*1024*1024;
    public static string ProgressPath;
    public static long WrittenBytes,ReadBytes,ExpectedBytes;
    public static uint SectorBytes;
    static Stopwatch phaseClock=new Stopwatch(); static long lastProgress;
    static string phase;
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern SafeFileHandle CreateFile(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool WriteFile(SafeFileHandle file,IntPtr buffer,uint bytes,out uint written,IntPtr overlapped);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool ReadFile(SafeFileHandle file,IntPtr buffer,uint bytes,out uint read,IntPtr overlapped);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool FlushFileBuffers(SafeFileHandle file);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr VirtualAlloc(IntPtr address,UIntPtr size,uint allocation,uint protection);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool VirtualFree(IntPtr address,UIntPtr size,uint freeType);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool GetDiskFreeSpace(string root,out uint sectorsPerCluster,out uint bytesPerSector,out uint freeClusters,out uint totalClusters);
    public static long ClusterBytes() {
        uint s,b,f,t;if(!GetDiskFreeSpace("D:/",out s,out b,out f,out t))throw new Win32Exception(Marshal.GetLastWin32Error());
        SectorBytes=b; if(b==0 || Chunk%b!=0)throw new IOException("Unsupported sector alignment");return (long)s*b;
    }
    public static void BeginPhase(string value) {phase=value;phaseClock.Restart();lastProgress=-5000;Progress(true);}
    static void Progress(bool force) {
        if(!force && phaseClock.ElapsedMilliseconds-lastProgress<5000)return;
        lastProgress=phaseClock.ElapsedMilliseconds;
        string json="{\"phase\":\""+phase+"\",\"written_bytes\":"+WrittenBytes+",\"read_bytes\":"+ReadBytes+",\"expected_bytes\":"+ExpectedBytes+",\"phase_seconds\":"+phaseClock.Elapsed.TotalSeconds.ToString("F3",System.Globalization.CultureInfo.InvariantCulture)+"}";
        File.WriteAllText(ProgressPath,json,new UTF8Encoding(false));
    }
    static ulong Mix(ulong value) {
        unchecked {value+=0x9E3779B97F4A7C15UL;value=(value^(value>>30))*0xBF58476D1CE4E5B9UL;value=(value^(value>>27))*0x94D049BB133111EBUL;return value^(value>>31);}
    }
    static void Fill(byte[] bytes,int count,long offset,ulong seed) {
        for(int i=0;i<count;i+=8) {
            ulong v=Mix(unchecked(seed+(ulong)((offset+i)/8)));
            for(int n=0;n<8;n++)bytes[i+n]=(byte)(v>>(n*8));
        }
    }
    static string Hex(byte[] value){return BitConverter.ToString(value).Replace("-","").ToLowerInvariant();}
    static IntPtr Buffer() {
        IntPtr p=VirtualAlloc(IntPtr.Zero,(UIntPtr)Chunk,0x3000,0x04);
        if(p==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
        if((ulong)p.ToInt64()%SectorBytes!=0){VirtualFree(p,UIntPtr.Zero,0x8000);throw new IOException("Native buffer is not sector aligned");}
        return p;
    }
    public static SdFileResult Write(string path,long length,long globalOffset,ulong seed) {
        if(length<=0 || length%SectorBytes!=0 || length%8!=0)throw new IOException("Unaligned file size");
        Stopwatch clock=Stopwatch.StartNew();IntPtr native=Buffer();
        try {
            // CREATE_NEW, NO_BUFFERING, WRITE_THROUGH. Never overwrites a file.
            using(SafeFileHandle file=CreateFile(path,0x40000000,0,IntPtr.Zero,1,0xA0000080,IntPtr.Zero)) {
                if(file.IsInvalid)throw new Win32Exception(Marshal.GetLastWin32Error(),"Create test file "+path);
                using(SHA256 sha=SHA256.Create()) {
                    byte[] bytes=new byte[Chunk];long done=0;
                    while(done<length) {
                        int n=(int)Math.Min(Chunk,length-done);Fill(bytes,n,globalOffset+done,seed);sha.TransformBlock(bytes,0,n,bytes,0);Marshal.Copy(bytes,0,native,n);
                        uint wrote;bool ok=WriteFile(file,native,(uint)n,out wrote,IntPtr.Zero);int error=Marshal.GetLastWin32Error();WrittenBytes+=wrote;
                        if(!ok || wrote!=n)throw new Win32Exception(error,"Write failed/short at "+path+" offset="+done+" actual="+wrote);
                        done+=wrote;Progress(false);
                    }
                    if(!FlushFileBuffers(file))throw new Win32Exception(Marshal.GetLastWin32Error(),"FlushFileBuffers failed "+path);
                    sha.TransformFinalBlock(new byte[0],0,0);return new SdFileResult{Bytes=done,Sha256=Hex(sha.Hash),Seconds=clock.Elapsed.TotalSeconds};
                }
            }
        } finally {VirtualFree(native,UIntPtr.Zero,0x8000);Progress(true);}
    }
    public static SdFileResult Read(string path,long length) {
        if(new FileInfo(path).Length!=length)throw new IOException("Test file size changed "+path);
        Stopwatch clock=Stopwatch.StartNew();IntPtr native=Buffer();
        try {
            // OPEN_EXISTING, NO_BUFFERING. Windows file-data cache is bypassed.
            using(SafeFileHandle file=CreateFile(path,0x80000000,0,IntPtr.Zero,3,0x20000080,IntPtr.Zero)) {
                if(file.IsInvalid)throw new Win32Exception(Marshal.GetLastWin32Error(),"Open unbuffered read "+path);
                using(SHA256 sha=SHA256.Create()) {
                    byte[] bytes=new byte[Chunk];long done=0;
                    while(done<length) {
                        int n=(int)Math.Min(Chunk,length-done);uint got;bool ok=ReadFile(file,native,(uint)n,out got,IntPtr.Zero);int error=Marshal.GetLastWin32Error();ReadBytes+=got;
                        if(!ok || got!=n)throw new Win32Exception(error,"Read failed/short at "+path+" offset="+done+" actual="+got);
                        Marshal.Copy(native,bytes,0,n);sha.TransformBlock(bytes,0,n,bytes,0);done+=got;Progress(false);
                    }
                    sha.TransformFinalBlock(new byte[0],0,0);return new SdFileResult{Bytes=done,Sha256=Hex(sha.Hash),Seconds=clock.Elapsed.TotalSeconds};
                }
            }
        } finally {VirtualFree(native,UIntPtr.Zero,0x8000);Progress(true);}
    }
}
