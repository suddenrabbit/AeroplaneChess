export const defaults=()=>({types:['human','ai','ai','off'],levels:[2,2,2,2],test:false});
export function parseConfig(q, seed=defaults()) {
  const cfg=structuredClone(seed),n=q.get('n'),t=q.get('t');
  const parseType=v=>(v==='h'||v==='human')?'human':(v==='o'||v==='off'||v==='x'||v==='closed')?'off':'ai';
  const tokens=t?t.split(','):[];
  // Only old short-form links retain the historical n=2 red/yellow mapping.
  if(n&&['2','3','4'].includes(n)&&tokens.length<4&&!tokens.some(v=>parseType(v)==='off')){
    const seats=n==='2'?[0,2]:n==='3'?[0,1,2]:[0,1,2,3];cfg.types=['off','off','off','off'];
    seats.forEach((si,i)=>{cfg.types[si]=tokens[i]?parseType(tokens[i]):i===0?'human':'ai';});
  } else if(tokens.length)tokens.forEach((v,i)=>{if(i<4)cfg.types[i]=parseType(v);});
  if(q.has('l'))q.get('l').split(',').forEach((v,i)=>{if(i<4)cfg.levels[i]=+v===1?1:2;});
  if(q.has('test'))cfg.test=q.get('test')==='1';return cfg;
}
export function routeTheme(q) {
  if(q.has('theme'))return ['acrylic','cartoon'].includes(q.get('theme'))?q.get('theme'):'invalid';
  return ['n','t','l','test','auto'].some(k=>q.has(k))?'acrylic':null;
}
export function configQuery(theme,cfg) {
  return new URLSearchParams({theme,t:cfg.types.map(t=>({human:'h',ai:'a',off:'o'})[t]).join(','),l:cfg.levels.join(','),test:cfg.test?'1':'0'});
}
