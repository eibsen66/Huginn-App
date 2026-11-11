"""Bounded Windows console receive only: no reset, write, baud or line changes."""
import ctypes as c
from ctypes import wintypes as w
from pathlib import Path
from datetime import datetime, timezone
import json, os, time
from serial.tools import list_ports

BASE=Path('C:/HuginnEIS/Evidence/REV2.3-COM5')
BASE.mkdir(parents=True, exist_ok=True)
OUT=BASE/('console-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
OUT.mkdir()
def utc(): return datetime.now(timezone.utc).isoformat()
ports=[p for p in list_ports.comports() if p.device.upper()=='COM5']
if len(ports)!=1: raise RuntimeError('COM5 unavailable')
k=c.WinDLL('kernel32',use_last_error=True)
k.CreateFileW.argtypes=[w.LPCWSTR,w.DWORD,w.DWORD,c.c_void_p,w.DWORD,w.DWORD,w.HANDLE]
k.CreateFileW.restype=w.HANDLE
k.CloseHandle.argtypes=[w.HANDLE]
k.ReadFile.argtypes=[w.HANDLE,c.c_void_p,w.DWORD,c.POINTER(w.DWORD),c.c_void_p]
k.ReadFile.restype=w.BOOL
class Timeouts(c.Structure):
    _fields_=[(n,w.DWORD) for n in ('ReadIntervalTimeout','ReadTotalTimeoutMultiplier','ReadTotalTimeoutConstant','WriteTotalTimeoutMultiplier','WriteTotalTimeoutConstant')]
k.GetCommTimeouts.argtypes=[w.HANDLE,c.POINTER(Timeouts)]
k.SetCommTimeouts.argtypes=[w.HANDLE,c.POINTER(Timeouts)]
class DCB(c.Structure):
    _fields_=[('length',w.DWORD),('baud',w.DWORD),('flags',w.DWORD),('reserved',w.WORD),('xonlim',w.WORD),('xofflim',w.WORD),('bytesize',c.c_ubyte),('parity',c.c_ubyte),('stopbits',c.c_ubyte),('xon',c.c_char),('xoff',c.c_char),('error',c.c_char),('eof',c.c_char),('evt',c.c_char),('reserved1',w.WORD)]
k.GetCommState.argtypes=[w.HANDLE,c.POINTER(DCB)]
handle=k.CreateFileW(r'\\.\COM5',0x80000000,0,None,3,0,None)
if handle==w.HANDLE(-1).value: raise c.WinError(c.get_last_error())
old=Timeouts();have_timeouts=False
facts={'pid':os.getpid(),'port':'COM5','usb_serial':ports[0].serial_number,
       'started_utc':utc(),'max_seconds':600,'bytes_received':0,
       'writes_sent':0,'reset_commands':0,'control_line_changes_requested':0,
       'baud_changes_requested':0,'automatic_reconnect':False,'folder':str(OUT)}
try:
    if not k.GetCommTimeouts(handle,c.byref(old)): raise c.WinError(c.get_last_error())
    have_timeouts=True
    state=DCB();state.length=c.sizeof(DCB)
    if not k.GetCommState(handle,c.byref(state)): raise c.WinError(c.get_last_error())
    facts['inherited_comm_state']={'baud':state.baud,'flags':state.flags,'bytesize':state.bytesize,'parity':state.parity,'stopbits':state.stopbits}
    timeout=Timeouts(0xffffffff,0,100,0,0)
    if not k.SetCommTimeouts(handle,c.byref(timeout)): raise c.WinError(c.get_last_error())
    start=time.monotonic();last_status=start
    facts['status']='ARMED'
    (OUT/'status.json').write_text(json.dumps(facts,indent=2))
    (BASE/'active-console.json').write_text(json.dumps(facts,indent=2))
    print('ARMED '+str(OUT),flush=True)
    with (OUT/'console.raw').open('xb',buffering=0) as raw, (OUT/'console.jsonl').open('x',encoding='utf8',buffering=1) as log:
        log.write(json.dumps({'at_utc':utc(),'event':'ARMED','facts':facts})+'\n')
        buf=c.create_string_buffer(8192)
        while time.monotonic()-start<600 and not (OUT/'STOP').exists():
            count=w.DWORD()
            if not k.ReadFile(handle,buf,len(buf),c.byref(count),None):
                raise c.WinError(c.get_last_error())
            if count.value:
                data=buf.raw[:count.value];offset=facts['bytes_received']
                raw.write(data);os.fsync(raw.fileno());facts['bytes_received']+=len(data)
                log.write(json.dumps({'at_utc':utc(),'elapsed_s':time.monotonic()-start,'offset':offset,'bytes':len(data),'text':data.decode('utf8',errors='replace')})+'\n')
                log.flush();os.fsync(log.fileno())
            if time.monotonic()-last_status>=1:
                facts['elapsed_s']=time.monotonic()-start
                (OUT/'status.json').write_text(json.dumps(facts,indent=2));last_status=time.monotonic()
        facts['status']='STOPPED';facts['ended_utc']=utc()
        facts['stop_reason']='owner_stop_marker' if (OUT/'STOP').exists() else '600_second_bound'
except KeyboardInterrupt:
    facts['status']='STOPPED';facts['stop_reason']='owner_interrupt';facts['ended_utc']=utc()
except BaseException as error:
    facts['status']='STOPPED_ERROR';facts['error']=repr(error);facts['ended_utc']=utc()
    raise
finally:
    if have_timeouts:k.SetCommTimeouts(handle,c.byref(old))
    k.CloseHandle(handle)
    (OUT/'status.json').write_text(json.dumps(facts,indent=2))
    print(json.dumps(facts),flush=True)
