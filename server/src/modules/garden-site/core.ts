import {HttpException} from '@nestjs/common';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Request} from 'express';
import {canonical} from '../../../../shared/src/pinyin-garden/cloud';
export const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export const requestHash=(v:unknown)=>digest(canonical(v));
export const token=()=>randomBytes(32).toString('hex');
export const id=()=>randomUUID();
export const code=()=>randomBytes(16).toString('hex').toUpperCase();
export const normalizeCode=(v:string)=>v.trim().replace(/-/g,'').toUpperCase();
export function fail(status:number,code:string,message:string,details?:unknown):never{throw new HttpException({error:{code,message,details}},status);}
export function json<T=any>(v:unknown):T{return (typeof v==='string'?JSON.parse(v):v) as T;}
export interface Actor {id:string;username:string;role:string;sessionId:string;csrf:string}
export type SiteRequest=Request&{actor?:Actor};
export const cookieName=()=>process.env.NODE_ENV==='production'?'__Host-garden_session':'garden_dev_session';
export const cookieOptions=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'});
export const userView=(u:any)=>({id:u.id,username:u.username_normalized,role:u.user_role});
