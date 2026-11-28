import fs from 'node:fs';
export function parseMountainCsv(text){
 const rows=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 const split=line=>{const fields=[];let v='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){fields.push(v);v=''}else v+=c}if(quoted)throw Error('Invalid CSV quoting');fields.push(v);return fields};
 const h=split(rows.shift());const cols=['山名＜山頂名＞','標高値(m)','緯度','経度'].map(k=>h.indexOf(k));if(cols.some(i=>i<0))throw Error('GSI CSV schema changed');
 const unique=new Map();
 for(const line of rows){if(!line.trim())continue;const f=split(line),[name,height,lat,lon]=cols.map(i=>f[i]);const n=[name,Number(height),Number(lat),Number(lon)];
  if(!name||!n.slice(1).every(Number.isFinite)||n[2]<20||n[2]>46||n[3]<122||n[3]>154)throw Error('Invalid summit row '+line);
  unique.set(n.join('|'),n);
 }
 return [...unique.values()];
}
if(process.argv[1]?.endsWith('import-mountains.mjs')&&process.argv[2]){
 const bytes=fs.readFileSync(process.argv[2]);let s;try{s=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{s=new TextDecoder('shift_jis').decode(bytes)}
 const peaks=parseMountainCsv(s);if(peaks.length<1000||peaks.length>1100)throw Error('Unexpected catalogue count '+peaks.length);
 fs.writeFileSync(process.argv[3],JSON.stringify({source:'国土地理院「日本の主な山岳標高一覧（1003山）」2026-03-31版を加工',url:'https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html',peaks}));
 console.log('SUMMIT_COUNT',peaks.length);
}
