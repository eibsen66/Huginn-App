using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
public static class HuginnLauncher {
  static readonly string[] Assets={"index.html","app.js","style.css","settings-package.mjs","status-package.mjs",
    "direct-status-receive.mjs","muninn-status-transfer.mjs","flight-evidence.mjs","flight-storage.mjs","flight-compatibility.json"};
  public static int Main(string[] args) {
    bool dev=false, open=true;
    foreach(string arg in args) {if(arg=="--development")dev=true;else if(arg=="--no-browser")open=false;else{
      Console.Error.WriteLine("Unknown option: "+arg);return 2;}}
    int result=Run(Path.Combine(AppContext.BaseDirectory,"assets"),dev?8768:8767,open,false);
    if(result!=0 && open){Console.Error.WriteLine("Launcher failed. Press Enter to close.");Console.ReadLine();}
    return result;
  }
  public static int Run(string root,int port,bool open,bool testing) {
    if(port!=8767 && port!=8768) {Console.Error.WriteLine("Only frozen ports 8767/8768 are allowed.");return 2;}
    TcpListener listener=null;
    try {
      var assets=new Dictionary<string,byte[]>(StringComparer.Ordinal);
      foreach(string leaf in Assets)assets.Add("/"+leaf,File.ReadAllBytes(Path.Combine(root,leaf)));
      assets.Add("/",assets["/index.html"]);
      if(testing){assets.Add("/courier-ui.mjs",File.ReadAllBytes(Path.Combine(root,"courier-ui.mjs")));assets.Add("/flight-courier.mjs",File.ReadAllBytes(Path.Combine(root,"flight-courier.mjs")));assets.Add("/__test__/courier.mjs",File.ReadAllBytes(Path.Combine(root,"tests","courier-ui.browser.mjs")));assets.Add("/__test__/courier.html",Encoding.UTF8.GetBytes("<!doctype html><meta name=viewport content=width=device-width,initial-scale=1><link rel=stylesheet href=/style.css><script type=module>import('/__test__/courier.mjs').then(m=>m.run()).then(r=>window.testResult=r).catch(e=>window.testResult={error:String(e),stack:e.stack});</script>"));assets.Add("/__test__/storage.mjs",File.ReadAllBytes(Path.Combine(root,"tests","flight-storage.browser.mjs")));
        assets.Add("/__test__/vectors.json",File.ReadAllBytes(Path.Combine(root,"tests","fixtures","flight-v1-vectors.json")));
        assets.Add("/__test__/index.html",Encoding.UTF8.GetBytes("<!doctype html><title>Local synthetic storage tests</title><script type='module'>import('/__test__/storage.mjs').then(m=>m.run()).then(r=>window.testResult=r).catch(e=>window.testResult={error:String(e),stack:e.stack});</script>"));}
      listener=new TcpListener(IPAddress.Parse("127.0.0.1"),port);listener.Start();
      Console.WriteLine("READY http://127.0.0.1:"+port);Console.Out.Flush();
      if(open)OpenEdge("http://127.0.0.1:"+port+"/");
      while(true){using(TcpClient client=listener.AcceptTcpClient()){
        client.ReceiveTimeout=5000;client.SendTimeout=5000;
        try{Handle(client.GetStream(),port,assets);}catch(IOException){}catch(SocketException){}
      }}
    }catch(Exception e){Console.Error.WriteLine("HuginnAPP launcher failed on fixed port "+port+": "+e.Message);return 1;}
    finally{if(listener!=null)listener.Stop();}
  }
  static void OpenEdge(string url) {
    string edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");
    if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe");
    if(!File.Exists(edge))throw new FileNotFoundException("Microsoft Edge is required.");
    Process.Start(new ProcessStartInfo(edge,url){UseShellExecute=true});
  }
  static void Handle(NetworkStream stream,int port,Dictionary<string,byte[]> assets) {
    var header=new List<byte>();int state=0;
    while(header.Count<8192){int b=stream.ReadByte();if(b<0)return;header.Add((byte)b);
      state=(state==0&&b==13)?1:(state==1&&b==10)?2:(state==2&&b==13)?3:(state==3&&b==10)?4:0;
      if(state==4)break;}
    if(state!=4){Reply(stream,431,"Request Header Fields Too Large",null,false,null);return;}
    foreach(byte b in header)if(b!=13&&b!=10&&(b<32||b>126)){Reply(stream,400,"Bad Request",null,false,null);return;}
    string[] lines=Encoding.ASCII.GetString(header.ToArray()).Split(new[]{"\r\n"},StringSplitOptions.None);
    string[] first=lines[0].Split(' ');
    if(first.Length!=3 || (first[2]!="HTTP/1.1"&&first[2]!="HTTP/1.0")){Reply(stream,400,"Bad Request",null,false,null);return;}
    string host=null;bool bad=false;
    for(int i=1;i<lines.Length-2;i++){
      int colon=lines[i].IndexOf(':');if(colon<=0){bad=true;break;}
      string key=lines[i].Substring(0,colon),value=lines[i].Substring(colon+1).Trim();
      if(key.Equals("Host",StringComparison.OrdinalIgnoreCase)){if(host!=null)bad=true;host=value;}
      if(key.Equals("Transfer-Encoding",StringComparison.OrdinalIgnoreCase))bad=true;
      if(key.Equals("Content-Length",StringComparison.OrdinalIgnoreCase)&&value!="0")bad=true;
    }
    if(bad||host!="127.0.0.1:"+port){Reply(stream,400,"Bad Request",null,false,null);return;}
    if(first[0]!="GET"&&first[0]!="HEAD"){Reply(stream,405,"Method Not Allowed",null,false,"Allow: GET, HEAD\r\n");return;}
    string target=first[1];
    if(!target.StartsWith("/",StringComparison.Ordinal)||target.Contains("..")||target.Contains("%")||target.Contains("\\")||target.Contains("//")){
      Reply(stream,400,"Bad Request",null,false,null);return;}
    byte[] payload;
    if(!assets.TryGetValue(target,out payload)){Reply(stream,404,"Not Found",null,first[0]=="HEAD",null);return;}
    string mime=target.EndsWith(".mjs")||target.EndsWith(".js")?"text/javascript; charset=utf-8":
      target.EndsWith(".css")?"text/css; charset=utf-8":target.EndsWith(".json")?"application/json; charset=utf-8":"text/html; charset=utf-8";
    Reply(stream,200,"OK",payload,first[0]=="HEAD","Content-Type: "+mime+"\r\n");
  }
  static void Reply(NetworkStream stream,int code,string reason,byte[] bytes,bool head,string extra) {
    bytes=bytes??Encoding.UTF8.GetBytes(reason+"\n");
    byte[] h=Encoding.ASCII.GetBytes("HTTP/1.1 "+code+" "+reason+"\r\nContent-Length: "+bytes.Length+
      "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n"+(extra??"Content-Type: text/plain; charset=utf-8\r\n")+"\r\n");
    stream.Write(h,0,h.Length);if(!head)stream.Write(bytes,0,bytes.Length);
  }
}
