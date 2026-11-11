import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='C:/HuginnAPP/build/settings-protocol-host';
await mkdir(out+'/freertos',{recursive:true});
const active=process.argv.includes('--active');
const mainPath=active?root+'/main/main.c':'C:/HuginnAPP/build/settings-proposed/main/main.c';
const settingsPath=active?root+'/main/huginn_settings_v2.inc':'C:/HuginnAPP/protocol/firmware/huginn_settings_v2.inc';
const s=(await readFile(mainPath,'utf8')).replaceAll('\r\n','\n');
const lexical=s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,m=>m.replace(/[^\n]/g,' '));
function fn(name){const re=new RegExp('\\b'+name+'\\s*\\([^;{}]*\\)\\s*\\{','g');let m=re.exec(lexical);if(!m)throw Error(name);const start=s.lastIndexOf('\nstatic ',m.index)+1;let depth=1,p=lexical.indexOf('{',m.index)+1;for(;depth;p++){if(lexical[p]==='{')depth++;if(lexical[p]==='}')depth--;}return s.slice(start,p)+'\n';}
const begin=s.indexOf('#define HUGINN_ENGINE_PROFILE_MAX_ZONES'),end=s.indexOf('#undef HUGINN_ZONE_ABOVE',begin)+'#undef HUGINN_ZONE_ABOVE'.length;
const sb=s.indexOf('#define FUEL_DEFAULT_TOTAL_L'),se=s.indexOf('static HuginnSettings g_settings',sb),initEnd=s.indexOf('\n};',se)+4;
const fuelNames=s.slice(s.indexOf('static const char *g_available_fuel_names'),s.indexOf('static bool huginn_decode_fuel_preset_option'));
let code=`#define _GNU_SOURCE\n#include <stdint.h>\n#include <stdbool.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <limits.h>\n#include <math.h>\n#include <assert.h>\n#include <openssl/sha.h>\n#include "cJSON.h"\n#include "huginn_ports.h"\n#include "huginn_aux.h"\n`;
code+=s.slice(begin,end)+'\n'+s.slice(sb,initEnd)+'\nstatic HuginnAircraftEngineConfiguration g_aircraft_engine_configuration;\n';
code+=fuelNames+'\n'+fn('huginn_decode_fuel_preset_option');
for(const name of ['huginn_builtin_engine_profile_identity_for_configuration','huginn_builtin_engine_profile_identity_for_settings','huginn_builtin_engine_profile_build_for_configuration','huginn_builtin_engine_profile_build_for_settings','huginn_engine_zone_valid','huginn_engine_rpm_parameter_shape_valid','huginn_engine_parameter_configuration_valid','huginn_engine_profile_configuration_valid','huginn_aircraft_engine_configuration_initialize_for_configuration','huginn_aircraft_engine_configuration_initialize_for_settings','huginn_aircraft_engine_configuration_matches_settings','huginn_aircraft_engine_configuration_reconcile_with_settings','huginn_engine_unit_name','huginn_engine_zone_name','settings_engine_parameter_boundary_descriptors','settings_engine_parameter_shape_valid','settings_engine_boundary_side_name']){
 if(name==='settings_engine_parameter_boundary_descriptors')code+='\n#define HUGINN_ENGINE_EDIT_MAX_BOUNDARIES 6U\ntypedef struct {int32_t value_milliunits;int8_t zone_below,zone_above;} HuginnEngineBoundaryDescriptor;\n';
 code+=fn(name);
}
code+=await readFile('protocol/host-seams.c','utf8');
code+='\n#define HS2_HOST_MODEL 1\n#define HUGINN_DEV_HTTPS_AVAILABLE 1\n#include "'+out.replace('C:','/mnt/c')+'/settings.inc"\n';
code+=await readFile('protocol/host-driver.c','utf8');
await writeFile(out+'/model.c',code);await writeFile(out+'/settings.inc',await readFile(settingsPath));
await writeFile(out+'/freertos/FreeRTOS.h','typedef int portMUX_TYPE;\n#define portMUX_INITIALIZER_UNLOCKED 0\n#define portENTER_CRITICAL(x) ((void)(x))\n#define portEXIT_CRITICAL(x) ((void)(x))\n');
const linux=p=>p.replace(/^C:/,'/mnt/c');
const args=['-d','Ubuntu','--exec','gcc','-std=c11','-D_GNU_SOURCE','-Wall','-Wextra','-Werror','-Werror=misleading-indentation','-Wno-unused-function','-Wno-sign-compare','-Wno-format-truncation','-ffunction-sections','-fdata-sections','-I'+linux(out),'-I'+linux(root+'/main'),'-I/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON',linux(out+'/model.c'),linux(root+'/main/huginn_ports.c'),linux(root+'/main/huginn_aux.c'),'/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON/cJSON.c','-Wl,--gc-sections','-lm','-lcrypto','-o',linux(out+'/model')];
args.splice(args.indexOf('-D_GNU_SOURCE'),1);execFileSync('wsl',args,{stdio:'inherit',windowsHide:true});
const httpCode=code.replace('#define HS2_HOST_MODEL 1',await readFile('protocol/host-http-stubs.h','utf8'));await writeFile(out+'/http-syntax.c',httpCode);
execFileSync('wsl',['-d','Ubuntu','--exec','gcc','-std=c11','-Wall','-Wextra','-Werror','-Werror=misleading-indentation','-Wno-unused-function','-Wno-sign-compare','-Wno-format-truncation','-I'+linux(out),'-I'+linux(root+'/main'),'-I/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON','-fsyntax-only',linux(out+'/http-syntax.c')],{stdio:'inherit',windowsHide:true});
console.log('Host model and HTTP boundary syntax checked with actual engine/PORTS/AUX validators. Not an ESP-IDF build.');
const pins={};for(const path of [mainPath,settingsPath,'protocol/host-seams.c','protocol/host-driver.c'])pins[path]=createHash('sha256').update(await readFile(path)).digest('hex');await writeFile(out+'/pins.json',JSON.stringify(pins,null,2));
console.log('Host model source: '+(active?'applied HuginnEIS files':'unapplied proposal'));
