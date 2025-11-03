function base64UrlDecode(str){
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return atob(str);
}
export function decodeJwt(token){
  if(!token) return null;
  try{ const [,p] = token.split('.'); return JSON.parse(base64UrlDecode(p)); }catch{ return null; }
}
export function getExpiryMs(token){
  const p = decodeJwt(token); if(!p?.exp) return null; return p.exp * 1000;
}
