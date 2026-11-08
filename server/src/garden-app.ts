import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {HttpException,type ArgumentsHost} from '@nestjs/common';
import {json as bodyParser,type Response,type NextFunction} from 'express';
import {ZodError} from 'zod';
import {GardenSiteModule} from './garden-site.module';
import {AuthService} from './modules/garden-site/auth.service';
import {cookieName,fail,id,type SiteRequest} from './modules/garden-site/core';
export async function createGardenApp(){
 const origin=process.env.PUBLIC_ORIGIN??(process.env.NODE_ENV==='production'?'':'http://localhost:5173');
 if(!origin||new URL(origin).origin!==origin)throw Error('PUBLIC_ORIGIN must be an exact origin');
 if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw Error('Production requires HTTPS');
 const app=await NestFactory.create(GardenSiteModule,{bodyParser:false,logger:['error','warn']});app.setGlobalPrefix('api');
 const instance=app.getHttpAdapter().getInstance();instance.disable('x-powered-by');instance.set('trust proxy',process.env.TRUST_PROXY?.split(',')??false);
 app.use((req:SiteRequest,res:Response,next:NextFunction)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Request-Id',id());next();});
 app.use((req:SiteRequest,res:Response,next:NextFunction)=>{const limit=req.path==='/api/garden/archives'?'24mb':req.path.startsWith('/api/garden/profiles/')?'1100kb':'64kb';bodyParser({limit})(req,res,next);});
 const auth=app.get(AuthService);
 const publicPaths=new Set(['/api/health','/api/ready','/api/auth/register','/api/auth/login','/api/auth/reset-password']);
 const error=(err:any,res:Response)=>{const status=err instanceof ZodError?400:err instanceof HttpException?err.getStatus():err.status===413?413:err.type==='entity.parse.failed'?400:500;const result=err instanceof HttpException?err.getResponse():{error:{code:status===413?'PAYLOAD_TOO_LARGE':status===400?'INVALID_INPUT':'SERVICE_UNAVAILABLE',message:status===400?'输入格式不正确':status===413?'提交内容太大':'服务暂不可用'}};const payload=typeof result==='object'&&'error' in result?result:{error:{code:'REQUEST_FAILED',message:'请求失败'}};if(status===429)res.setHeader('Retry-After',(payload as any).error.details?.retryAfter??60);res.status(status).json({...payload,requestId:res.getHeader('X-Request-Id')});};
 app.use(async(req:SiteRequest,res:Response,next:NextFunction)=>{try{
  if(!/^\/api\/(auth|admin|garden)(\/|$)/.test(req.path)){next();return;}
  const write=!['GET','HEAD'].includes(req.method);
  if(write&&(req.headers.origin!==origin||!req.is('application/json')))fail(403,'CSRF_INVALID','请求来源不正确');
  if(!publicPaths.has(req.path)){
   const cookies=Object.fromEntries((req.headers.cookie??'').split(';').map(c=>c.trim().split('=')));req.actor=await auth.authenticate(cookies[cookieName()]);
   if(req.get('X-Garden-User')&&req.get('X-Garden-User')!==req.actor.id)fail(401,'ACCOUNT_CHANGED','账号已切换，请登录原账号');
   if(write&&req.get('X-CSRF-Token')!==req.actor.csrf)fail(403,'CSRF_INVALID','页面已过期，请刷新');
   if(req.path.startsWith('/api/admin/')&&req.actor.role!=='admin')fail(403,'FORBIDDEN','需要管理员权限');
   await auth.rate(req.actor.id+':'+((req.path.endsWith('/events')||req.path.startsWith('/api/garden/archives'))?'events':write?'write':'read'),(req.path.endsWith('/events')||req.path.startsWith('/api/garden/archives'))?300:write?30:120,60);
  }else if(write){await auth.rate(req.path+':'+req.ip,req.path.endsWith('register')?10:req.path.endsWith('login')?30:10,req.path.endsWith('register')?3600:900);}
  next();
 }catch(e){error(e,res);}});
 app.useGlobalFilters({catch:(e:unknown,host:ArgumentsHost)=>error(e,host.switchToHttp().getResponse())});
 // Express parsing errors occur before Nest's exception filter.
 instance.use((err:any,_req:SiteRequest,res:Response,_next:NextFunction)=>error(err,res));
 await app.init();return app;
}
