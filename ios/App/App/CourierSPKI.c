#include "CourierSPKI.h"
/* Definite DER lengths only; reject nonminimal encodings and all overflow.
 * Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
 * TBSCertificate ::= SEQUENCE { [0] version OPTIONAL, serial, signature,
 * issuer, validity, subject, subjectPublicKeyInfo, ... } (RFC 5280).
 * This is an extractor, never a substitute for Security trust evaluation. */
typedef struct { size_t tag, content, end; uint8_t kind; } item;
static int tlv(const uint8_t *d,size_t cap,size_t at,item *x) {
    if(at>=cap || cap-at<2) return 0;
    x->tag=at; x->kind=d[at++];
    if((x->kind&31)==31) return 0;
    size_t n=d[at++];
    if(n&128) { size_t k=n&127; n=0;
        if(!k || k>sizeof(size_t) || k>cap-at || d[at]==0) return 0;
        for(size_t i=0;i<k;i++) { if(n>SIZE_MAX/256) return 0; n=n*256+d[at++]; }
        if(n<128) return 0;
    }
    if(n>cap-at) return 0;
    x->content=at; x->end=at+n; return 1;
}
int huginn_spki_slice(const uint8_t *d,size_t n,size_t *off,size_t *len) {
    item cert,tbs,x,alg,key; if(!d || !off || !len || n>16384) return 0;
    if(!tlv(d,n,0,&cert) || cert.kind!=0x30 || cert.end!=n) return 0;
    if(!tlv(d,cert.end,cert.content,&tbs) || tbs.kind!=0x30) return 0;
    size_t at=tbs.content;
    if(!tlv(d,tbs.end,at,&x)) return 0;
    if(x.kind==0xa0) { item v; if(!tlv(d,x.end,x.content,&v) || v.kind!=2 || v.end!=x.end) return 0; at=x.end; }
    const uint8_t kinds[5]={2,0x30,0x30,0x30,0x30};
    for(size_t i=0;i<5;i++) { if(!tlv(d,tbs.end,at,&x) || x.kind!=kinds[i]) return 0; at=x.end; }
    if(!tlv(d,tbs.end,at,&x) || x.kind!=0x30) return 0;
    if(!tlv(d,x.end,x.content,&alg) || alg.kind!=0x30) return 0;
    if(!tlv(d,x.end,alg.end,&key) || key.kind!=3 || key.end!=x.end || key.content==key.end || d[key.content]>7) return 0;
    *off=x.tag; *len=x.end-x.tag; return 1;
}

/* Explicit SAN only: never CN fallback. Inspect the original signed extension
 * after Security has verified its chain. GeneralName iPAddress is tag 0x87. */
int huginn_ip_san(const uint8_t *d,size_t n) {
    size_t off,len;item cert,tbs,x,exts,ext,oid,value,names,name;
    if(!huginn_spki_slice(d,n,&off,&len) || !tlv(d,n,0,&cert) || !tlv(d,cert.end,cert.content,&tbs)) return 0;
    size_t at=off+len;
    while(at<tbs.end) { if(!tlv(d,tbs.end,at,&x)) return 0;at=x.end;
        if(x.kind!=0xa3) continue;
        if(!tlv(d,x.end,x.content,&exts) || exts.kind!=0x30 || exts.end!=x.end) return 0;
        size_t p=exts.content;
        while(p<exts.end) { if(!tlv(d,exts.end,p,&ext) || ext.kind!=0x30) return 0;p=ext.end;
            if(!tlv(d,ext.end,ext.content,&oid) || oid.kind!=6) return 0;
            if(oid.end-oid.content!=3 || d[oid.content]!=0x55 || d[oid.content+1]!=0x1d || d[oid.content+2]!=0x11) continue;
            if(!tlv(d,ext.end,oid.end,&value)) return 0;
            if(value.kind==1) { if(value.end-value.content!=1 || !tlv(d,ext.end,value.end,&value)) return 0; }
            if(value.kind!=4 || value.end!=ext.end || !tlv(d,value.end,value.content,&names) || names.kind!=0x30 || names.end!=value.end) return 0;
            size_t q=names.content;int found=0;
            while(q<names.end) { if(!tlv(d,names.end,q,&name)) return 0;q=name.end;
                if(name.kind==0x87 && name.end-name.content==4 && d[name.content]==192 && d[name.content+1]==168 && d[name.content+2]==4 && d[name.content+3]==1) found=1;
            }
            return found;
        }
    }
    return 0;
}
