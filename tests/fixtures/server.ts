import { createServer, type ServerResponse, type IncomingMessage } from 'node:http';
import { createHash } from 'node:crypto';
import type { Socket } from 'node:net';

export async function fixture() {
  const sockets=new Set<Socket>();
  let origin='', external='';
  const send=(res:ServerResponse,body:string,type='text/html',status=200)=>{res.writeHead(status,{'Content-Type':type,'Access-Control-Allow-Origin':'*'});res.end(body);};
  const asset=createServer((req,res)=>{
    const path=new URL(req.url!,'http://localhost').pathname;
    if(path==='/cors-denied'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('cors denied');return;}
    if(path==='/post303'){res.writeHead(303,{Location:'/no-content','Access-Control-Allow-Origin':'*'});res.end();return;}
    if(path==='/no-content'){res.writeHead(204,{'Access-Control-Allow-Origin':'*'});res.end();return;}
    if(path==='/redirect'){res.writeHead(302,{Location:`${external}/pixel.svg`});res.end();return;}
    if(path==='/entry.js')return send(res,`fetch('${external}/nested?key=fixture-query-value')`,'text/javascript');
    if(path==='/style.css')return send(res,`@font-face{font-family:fixture;src:url('${external}/font.woff2')}body{font-family:fixture}`,'text/css');
    if(path==='/frame')return send(res,`<img src="${external}/frame.svg"><iframe src="${external}/inner"></iframe>`);
    if(path==='/inner')return send(res,`<img src="${external}/inner.svg">`);
    if(path==='/missing')return send(res,'missing','text/plain',404);
    if(path==='/broken'){req.socket.destroy();return;}
    if(path==='/pending'){res.writeHead(200,{'Access-Control-Allow-Origin':'*'});res.write('pending');return;}
    if(path.endsWith('.svg'))return send(res,'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>','image/svg+xml');
    return send(res,'fixture response','text/plain');
  });
  const handler=(req:IncomingMessage,res:ServerResponse)=>{
    const path=new URL(req.url!,'http://localhost').pathname;
    if(path==='/robots.txt')return send(res,`User-agent: *\nDisallow: /private\nSitemap: ${origin}/sitemap.xml`,'text/plain');
    if(path==='/sitemap.xml')return send(res,`<sitemapindex><sitemap><loc>${origin}/child.xml</loc></sitemap><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`,'application/xml');
    if(path==='/child.xml')return send(res,`<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/orphan</loc></url><url><loc>${origin}/private</loc></url><url><loc>${origin}/query?a=1&amp;b=2</loc></url></urlset>`,'application/xml');
    if(path==='/unsafe.xml')return send(res,'<!DOCTYPE x [<!ENTITY t SYSTEM "file:///etc/passwd">]><urlset/>','application/xml');
    if(path==='/sw.js')return send(res,`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>e.waitUntil(fetch('${external}/worker-fetch')));`,'text/javascript');
    if(path==='/sw')return send(res,`<script>navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(r=>r.active.postMessage('fetch'))</script>`);
    if(path==='/pending-page')return send(res,`<script>fetch('${external}/pending').then(r=>r.text()).catch(()=>{})</script>`);
    if(path==='/consent-lock')return send(res,`<style>body{overflow:hidden}</style><button id="accept" onclick="choose('accepted')">Accept</button><button id="reject" onclick="choose('rejected')">Reject</button><p id="state"></p><div style="height:3000px"></div><script>function choose(state){document.querySelector('#state').className=state;document.querySelector('#state').textContent=state;document.body.style.overflow='auto';fetch('${external}/'+state)}</script>`);
    if(path==='/diagnostics')return send(res,`<div id="state"></div><script>
      if(navigator.webdriver)document.querySelector('#state').className='auto-accepted';
      fetch('${external}/cors-denied').catch(()=>{});
      fetch('${external}/post303',{method:'POST'}).then(r=>{if(r.status===204)document.querySelector('#state').textContent='resolved';}).catch(()=>{});
      </script>`);
    if(path==='/csp'){
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src *; img-src *; style-src * 'unsafe-inline'");
      return send(res,`<script src="${external}/entry.js"></script>`);
    }
    if(path==='/away'){res.writeHead(302,{Location:external+'/frame'});res.end();return;}
    if(path==='/via'){res.writeHead(302,{Location:'/away'});res.end();return;}
    if(path==='/hang'){res.writeHead(200,{'Content-Type':'text/html'});res.write('<html>');return;}
    if(path==='/notfound')return send(res,'Not found','text/plain',404);
    if(path!=='/')return send(res,`<h1>Fixture page</h1><img src="${external}/pixel.svg">`);
    send(res,`<!doctype html><title>Local fixture</title><h1>Resource fixture</h1>
      <link rel="stylesheet" href="${external}/style.css"><script src="${external}/entry.js"></script>
      <img src="${external}/redirect"><iframe src="${external}/frame"></iframe>
      <a href="/contact">Contact</a><a href="/contact#section">Duplicate</a><a href="/private">Private</a>
      <a href="${external}/outside">External navigation</a><a href="/logout">Logout</a>
      <button id="accept" onclick="document.querySelector('#state').textContent='accepted';document.querySelector('#state').className='accepted';fetch('${external}/accepted')">Accept</button>
      <button id="reject" onclick="document.querySelector('#state').textContent='rejected';document.querySelector('#state').className='rejected';fetch('${external}/rejected')">Reject</button>
      <p id="state"></p><div style="height:1400px"></div><img id="lazy" data-src="${external}/lazy.svg">
      <script>fetch('${external}/missing');fetch('${external}/broken').catch(()=>{});
      new WebSocket('${external.replace('http:','ws:')}/socket');
      new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.src=e.target.dataset.src})).observe(document.querySelector('#lazy'));
      </script>`);
  };
  const server=createServer(handler);
  for(const s of [asset,server])s.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  asset.on('upgrade',(req,socket)=>{
    const hash=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${hash}\r\n\r\n`);
  });
  await new Promise<void>(r=>asset.listen(0,'127.0.0.1',r));external=`http://127.0.0.1:${(asset.address() as any).port}`;
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`;
  return {origin,external,close:async()=>{
    for(const socket of sockets)socket.destroy();
    await Promise.all([server,asset].map(s=>new Promise<void>(r=>s.close(()=>r()))));
  }};
}
