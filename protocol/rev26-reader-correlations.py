from pathlib import Path
p=Path('C:/HuginnEIS/Tools/rev26_read_diagnostic.py');s=p.read_text()
s=s.replace("'cache_result'}", "'cache_result'}")
at=s.index('\ndef main():')
s=s[:at]+'''
def request_correlations(sends,allocations,heaps):
    result=[]
    for end in [r for r in sends if r.get('event')=='end']:
        rid=end['id'];begins=[r for r in sends if r.get('id')==rid and r.get('event')=='begin']
        summaries=[r for r in allocations if r.get('id')==rid and r.get('event')=='summary']
        failures=[r for r in allocations if r.get('id')==rid and r.get('event')=='failure']
        outputs=[r for r in failures if r.get('site')=='bounce_output']
        samples=[r for r in heaps if r.get('id')==rid]
        complete=len(begins)==1 and len(summaries)==1
        summary=summaries[0] if summaries else {}
        complete=complete and summary.get('dropped')==0 and summary.get('records')==len(failures)
        complete=complete and all(r.get('task')==summary.get('task') for r in failures)
        if outputs:
            first=outputs[0]
            complete=complete and len(samples)==1 and all(samples[0].get(k)==first.get(k) for k in ['id','task','bytes','caps','site','function'])
            state='complete_first_output_failure_observation' if complete else 'incomplete_observation'
        else:
            state='no_output_allocation_failure_recorded' if complete and not samples else 'incomplete_observation'
        result.append({'id':rid,'task':summary.get('task'),'status':state,'http_result':end.get('http_result'),'tls_body_accepted':end.get('tls_body_accepted'),'allocation_records_dropped':summary.get('dropped')})
    return result
'''+s[at:]
s=s.replace("'dma_heap_observations':dma_heap_records(raw.decode('utf8',errors='replace'))", "'request_correlations':request_correlations(found,allocation_records(raw.decode('utf8',errors='replace')),dma_heap_records(raw.decode('utf8',errors='replace'))),'dma_heap_observations':dma_heap_records(raw.decode('utf8',errors='replace'))")
p.write_text(s,encoding='utf8',newline='\n')
