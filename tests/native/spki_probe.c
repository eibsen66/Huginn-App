#include "CourierSPKI.h"
#include <stdio.h>
#include <string.h>
int main(int argc, char **argv) { uint8_t b[16385]; size_t n=fread(b,1,sizeof(b),stdin),o=0,l=0;
 if(argc>1 && !strcmp(argv[1],"selftest")) {
    if(!huginn_spki_slice(b,n,&o,&l) || l!=294 || !huginn_ip_san(b,n)) return 5;
    for(size_t k=0;k<n;k++) if(huginn_spki_slice(b,k,&o,&l)) return 6;
    uint8_t old=b[0];b[0]=0x31;if(huginn_spki_slice(b,n,&o,&l)) return 7;b[0]=old;
    old=b[1];b[1]=0x80;if(huginn_spki_slice(b,n,&o,&l)) return 8;b[1]=old;
    for(size_t k=0;k+5<n;k++) if(b[k]==0x87 && b[k+1]==4 && b[k+2]==192 && b[k+3]==168 && b[k+4]==4 && b[k+5]==1) { b[k+5]=2;if(huginn_ip_san(b,n))return 9;b[k+5]=1; }
    printf("native SPKI/SAN: exact leaf slice, all %zu truncations, tag, indefinite length, IP mismatch PASS\n",n);return 0;
 }
 if(argc>1) return huginn_ip_san(b,n)?0:4;
 if(!huginn_spki_slice(b,n,&o,&l)) return 2;
 return fwrite(b+o,1,l,stdout)==l?0:3; }
