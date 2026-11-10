export class ApiError extends Error {constructor(public status:number,public code:string,message:string,public details?:any,public retryAfter=60){super(message);}}
let csrf='';
export function setCsrf(value:string){csrf=value;}
export async function api<T=any>(path:string,body?:unknown,method=body===undefined?'GET':'POST',expectedUser?:string):Promise<T>{
 const scopedPath=typeof location!=='undefined'&&location.pathname.startsWith('/admin')&&path.startsWith('/auth/')?'/admin'+path:path;
 // Older iPad browsers have AbortController but not AbortSignal.timeout.
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch('/api'+scopedPath,{method,signal:controller.signal,credentials:'same-origin',headers:{...(expectedUser?{'X-Garden-User':expectedUser}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf})},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===204)return undefined as T;
  const result=await response.json();if(!response.ok)throw new ApiError(response.status,result.error?.code??'ERROR',result.error?.message??'请求失败',result.error?.details,Number(response.headers.get('Retry-After')??60));return result;
 }finally{clearTimeout(timeout);}
}
export interface User {id:string;username:string;role:string}
export async function me(){const r=await api<{user:User;csrfToken:string}>('/auth/me');setCsrf(r.csrfToken);return r.user;}
