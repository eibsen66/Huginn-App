int main(void){
    huginn_aircraft_engine_configuration_initialize_for_settings();
    huginn_ports_default_configuration(&runtime_ports);committed.settings=g_settings;committed.ports_configuration=runtime_ports;committed.config_revision=17;
    memset(protected_state,0xa5,sizeof(protected_state));memset(fuel_state,0x5a,sizeof(fuel_state));memset(fault_state,0x3c,sizeof(fault_state));memset(recordings,0xc3,sizeof(recordings));
    char *line=NULL;size_t cap=0;
    while(getline(&line,&cap,stdin)>0){
        cJSON *envelope=cJSON_Parse(line);assert(envelope);const cJSON *method=hs2_get(envelope,"method"),*raw=hs2_get(envelope,"raw"),*fault=hs2_get(envelope,"fault");
        persist_fail=hs2_string(fault,"persist");readback_fail=hs2_string(fault,"readback")?1:hs2_string(fault,"rollback")?3:0;authorized=!hs2_string(fault,"auth");g_settings_modal=hs2_string(fault,"busy")?(void *)1:NULL;
        Hs2Job *j=calloc(1,sizeof(*j));j->refs=2;j->epoch=1;j->apply=hs2_string(method,"apply");snprintf(j->device,sizeof(j->device),"AA:BB:CC:DD:EE:FF");
        if(raw&&cJSON_IsString(raw)){if(hs2_request_bytes(raw->valuestring,strlen(raw->valuestring)))j->input=cJSON_Parse(raw->valuestring);if(!j->input)j->input=cJSON_CreateArray();unsigned char digest[32];SHA256((unsigned char *)raw->valuestring,strlen(raw->valuestring),digest);for(unsigned i=0;i<32;i++)snprintf(j->digest+2*i,3,"%02x",digest[i]);}
        hs2_owner(j);assert(j->response);char *out=cJSON_PrintUnformatted(j->response);puts(out);free(out);hs2_release(j);cJSON_Delete(envelope);
        for(unsigned i=0;i<sizeof(protected_state);i++)assert((unsigned char)protected_state[i]==0xa5);
        for(unsigned i=0;i<sizeof(fuel_state);i++)assert((unsigned char)fuel_state[i]==0x5a);
        for(unsigned i=0;i<sizeof(fault_state);i++)assert((unsigned char)fault_state[i]==0x3c);
        for(unsigned i=0;i<sizeof(recordings);i++)assert((unsigned char)recordings[i]==0xc3);
    }free(line);return 0;
}
