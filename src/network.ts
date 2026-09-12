import type { CDPSession } from 'playwright';
import type { Observation } from './model.js';

// Keep CDP records separate: matching by URL would confuse concurrent identical requests.
export async function observeNetwork(cdp: CDPSession,
  add: (url: string, type: string, source: Observation['source'], extra?: Partial<Observation>)=>Observation|undefined) {
  const requests=new Map<string,Observation>();
  cdp.on('Network.requestWillBeSent',event=>{
    const previous=requests.get(event.requestId);
    if(previous&&event.redirectResponse) {
      previous.status=event.redirectResponse.status;
      previous.responseAt=new Date(event.wallTime*1000).toISOString();
      previous.redirectAt=previous.responseAt;previous.complete=true;
    }
    const record=add(event.request.url,event.type?.toLowerCase()??'other','cdp',{
      requestId:event.requestId,method:event.request.method,protocolTimestamp:event.timestamp,
      timestamp:new Date(event.wallTime*1000).toISOString(),previousId:previous?.id,
      redirectedFrom:event.redirectResponse?.url
    });
    if(record){if(previous)previous.nextId=record.id;requests.set(event.requestId,record);}
    else requests.delete(event.requestId);
  });
  cdp.on('Network.responseReceived',event=>{
    const r=requests.get(event.requestId);if(r){r.status=event.response.status;r.responseAt=new Date().toISOString();}
  });
  cdp.on('Network.loadingFinished',event=>{
    const r=requests.get(event.requestId);if(r){r.complete=true;r.finishedAt=new Date().toISOString();delete r.observationEnd;}
  });
  cdp.on('Network.loadingFailed',event=>{
    const r=requests.get(event.requestId);if(r){
      r.complete=false;r.failure=event.errorText;r.failedAt=new Date().toISOString();
      r.blockedReason=event.blockedReason;r.corsErrorStatus=event.corsErrorStatus;
    }
  });
  await cdp.send('Network.enable');
  return (reason: 'visit-end'|'scan-abort')=>{
    for(const r of requests.values())if(r.complete===undefined&&!r.failure)r.observationEnd=reason;
  };
}
