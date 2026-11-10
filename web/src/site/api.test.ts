import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {api,ApiError,me,setCsrf} from './api';

describe('API requests on browsers without AbortSignal.timeout',()=>{
 const timeoutDescriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout')!;
 beforeEach(()=>{
  vi.useFakeTimers();
  Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined});
  setCsrf('');
 });
 afterEach(()=>{
  Object.defineProperty(AbortSignal,'timeout',timeoutDescriptor);
  vi.unstubAllGlobals();
  vi.useRealTimers();
 });

 it('logs in, loads the account and saves progress without the newer static API',async()=>{
  vi.stubGlobal('location',{pathname:'/garden/'});
  const user={id:'user-1',username:'player',role:'parent'};
  const fetchMock=vi.fn()
   .mockResolvedValueOnce(new Response(JSON.stringify({user,csrfToken:'login-token'})))
   .mockResolvedValueOnce(new Response(JSON.stringify({user,csrfToken:'account-token'})))
   .mockResolvedValueOnce(new Response(null,{status:204}));
  vi.stubGlobal('fetch',fetchMock);
  await expect(api('/auth/login',{username:'player',password:'example-password'})).resolves.toMatchObject({user});
  await expect(me()).resolves.toEqual(user);
  await expect(api('/garden/profiles/1',{revision:1},'PUT',user.id)).resolves.toBeUndefined();
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
  const options=fetchMock.mock.calls[2][1];
  expect(options.credentials).toBe('same-origin');
  expect(options.headers).toMatchObject({'X-CSRF-Token':'account-token','X-Garden-User':'user-1'});
  expect(options.signal.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
 });

 it('keeps administrator login scoped to the administrator API',async()=>{
  vi.stubGlobal('location',{pathname:'/admin/'});
  const fetchMock=vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch',fetchMock);
  await api('/auth/login',{username:'admin',password:'example-password'});
  expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/auth/login');
  expect(vi.getTimerCount()).toBe(0);
 });

 it('aborts a pending request at 30 seconds and clears the timer',async()=>{
  let signal:AbortSignal|undefined;
  vi.stubGlobal('fetch',vi.fn((_url,options:RequestInit)=>new Promise((_resolve,reject)=>{
   signal=options.signal!;
   signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  })));
  const result=api('/auth/login',{});
  const rejected=expect(result).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(29999);
  expect(signal!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await rejected;
  expect(signal!.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
 });

 it('keeps the timeout active while reading the response body',async()=>{
  const readBody=vi.fn((signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})));
  vi.stubGlobal('fetch',vi.fn(async(_url,options:RequestInit)=>({
   status:200,ok:true,
   json:()=>readBody(options.signal!),
  })));
  const rejected=expect(api('/auth/me')).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(0);
  expect(readBody).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(30000);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
 });

 it('preserves server errors and clears the timeout on failed requests',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'INVALID_CREDENTIALS',message:'账号或密码错误'}}),{status:401})));
  await expect(api('/auth/login',{})).rejects.toMatchObject({status:401,code:'INVALID_CREDENTIALS',message:'账号或密码错误'} satisfies Partial<ApiError>);
  expect(vi.getTimerCount()).toBe(0);
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Network error')));
  await expect(api('/auth/me')).rejects.toThrow('Network error');
  expect(vi.getTimerCount()).toBe(0);
 });
});
