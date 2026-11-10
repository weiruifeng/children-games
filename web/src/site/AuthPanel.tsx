import {useId,useState} from 'react';
import {api,me,type User} from './api';
import {Waji} from '../ui/Waji';
import {gardenBackdrop,SiteHeader,SiteIcon,SiteNotice,useSiteMotion} from './SitePrimitives';
type Mode='login'|'register'|'reset';
export function AuthPanel({onLogin,inline=false,admin=false}:{onLogin:(u:User)=>void;inline?:boolean;admin?:boolean}){
 const [mode,setMode]=useState<Mode>('login'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[success,setSuccess]=useState(false),[username,setUsername]=useState(''),[visible,setVisible]=useState(false),[greeting,setGreeting]=useState(0);
 const id=useId(),motion=useSiteMotion();
 const changeMode=(next:Mode)=>{setMode(next);setMessage('');setSuccess(false);setVisible(false);};
 async function submit(form:HTMLFormElement){
  if(busy)return;setBusy(true);setMessage('');setSuccess(false);const fields=Object.fromEntries(new FormData(form));
  try{
   if(mode==='register'){if(fields.password!==fields.confirm)throw Error('两次密码不一致，请再检查一下。');await api('/auth/register',{username:fields.username,password:fields.password,invitationCode:fields.code});setMode('login');setVisible(false);setSuccess(true);setMessage('注册成功！用户名已为你保留，输入密码就能进入花园。');}
   else if(mode==='reset'){await api('/auth/reset-password',{resetCode:fields.code,newPassword:fields.password});setMode('login');setVisible(false);setSuccess(true);setMessage('密码已更新，用新密码登录吧。');}
   else{await api('/auth/login',{username:fields.username,password:fields.password});onLogin(await me());}
  }catch(e){setMessage(e instanceof Error?e.message:'暂时没能打开花园，请稍后再试。');}finally{setBusy(false);}
 }
 const form=<section className="auth-paper" aria-label={admin?'管理员账号入口':'家长账号入口'}>
  <div className="auth-card-heading"><span className="site-eyebrow"><SiteIcon name="key"/> {admin?'拼音花园 · 园丁工作台':inline?'继续保管这份进度':'拼音花园'}</span><h1>{admin?'管理员登录':mode==='login'?'继续你的花园':mode==='register'?'一起种下新花园':'找回花园的钥匙'}</h1><p>{admin?'请使用管理员账号登录，管理邀请和家长账号。':mode==='login'?'登录后，继续上次的冒险。':mode==='register'?'用邀请码创建账号，开始花园冒险。':'请联系管理员，取得一次性密码重置码。'}</p></div>
  {!admin&&mode!=='reset'&&<nav className="site-segments auth-tabs" aria-label="登录或注册"><button type="button" disabled={busy} aria-pressed={mode==='login'} onClick={()=>changeMode('login')}>已有账号</button><button type="button" disabled={busy} aria-pressed={mode==='register'} onClick={()=>changeMode('register')}>邀请码注册</button></nav>}
  <form key={mode} className="auth-form site-enter" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}} aria-busy={busy}>
   <fieldset disabled={busy}>
    {mode!=='login'&&<div className="invitation-field"><label htmlFor={id+'code'}><SiteIcon name="key"/>{mode==='register'?'邀请码':'重置码'}</label><input id={id+'code'} name="code" required autoComplete="off" spellCheck={false} placeholder={mode==='register'?'粘贴管理员送给你的邀请码':'输入一次性重置码'}/><small>{mode==='register'?'每张邀请只使用一次，注册成功后会自动核销。':'重置码有效期为30分钟，使用后立即失效。'}</small></div>}
    {mode!=='reset'&&<div className="site-field"><label htmlFor={id+'user'}>用户名</label><input id={id+'user'} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)} required pattern="[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9_]{1,31}" placeholder={admin?'输入管理员账号':mode==='register'?'例如：小小园丁':'输入用户名'} aria-describedby={mode==='register'?id+'username-hint':undefined}/>{mode==='register'&&<small id={id+'username-hint'}>2–32个字，支持中文、字母、数字和下划线，以中文或字母开头。此名字会在平台上展示。</small>}</div>}
    <div className="site-field"><div className="field-label-row"><label htmlFor={id+'password'}>{mode==='reset'?'新密码':'密码'}</label>{!admin&&mode==='login'&&<button type="button" className="site-text-button" onClick={()=>changeMode('reset')}>忘记密码？</button>}</div><div className="password-input"><input id={id+'password'} name="password" type={visible?'text':'password'} required minLength={mode==='login'?1:6} maxLength={mode==='login'?128:32} autoComplete={mode==='login'?'current-password':'new-password'} aria-describedby={mode==='login'?undefined:id+'password-hint'} placeholder={mode==='login'?'输入密码':'设置6–32个字符的密码'}/><button type="button" className="password-toggle" aria-label={visible?'隐藏密码':'显示密码'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'隐藏':'显示'}</button></div>{mode!=='login'&&<small id={id+'password-hint'}>6–32个字符，建议使用字母和数字组合。</small>}</div>
    {mode==='register'&&<div className="site-field"><label htmlFor={id+'confirm'}>确认密码</label><input id={id+'confirm'} name="confirm" type={visible?'text':'password'} required minLength={6} maxLength={32} autoComplete="new-password" placeholder="再输入一次密码"/></div>}
    <button className={`site-button site-primary auth-submit ${busy?'is-working':''}`} disabled={busy}>{busy?<><SiteIcon/>正在处理…</>:<>{mode==='login'?'登录':mode==='register'?'注册':'更新密码'}<SiteIcon name="arrow"/></>}</button>
   </fieldset>
  </form>
  {message&&<SiteNotice key={message} kind={success?'success':'error'}>{message}</SiteNotice>}
  {mode==='reset'&&<button className="site-text-button auth-return" disabled={busy} onClick={()=>changeMode('login')}>← 返回登录</button>}
  {admin&&<p className="auth-footnote"><SiteIcon name="shield"/>{admin?'管理员账号由网站维护者创建，不开放注册。':''}</p>}
 </section>;
 if(inline)return <div className={`site-ui auth-inline ${motion.reduced?'reduced-motion':''}`}>{form}</div>;
 return <div className={`site-ui site-world ${motion.reduced?'reduced-motion':''}`}><SiteHeader onToggleMotion={motion.toggle} reduced={motion.reduced}><a className="site-back-link" href="/">← 学习首页</a></SiteHeader><main className="auth-scene" style={gardenBackdrop}>{form}<aside className="auth-companion"><span className="companion-tag"><SiteIcon/> 挖机的小苗圃</span><h2>{admin?<>小花园，<br/>一起照顾。</>:<>小花园，<br/>等你回家。</>}</h2><p>{admin?<>为新伙伴准备邀请，<br/>守护每一份成长记录。</>:<>把每一次勇敢尝试，<br/>都好好收藏起来。</>}</p><button className="auth-waji" aria-label="和挖机打招呼" onClick={()=>setGreeting(n=>n+1)}><Waji key={greeting+':'+success} animate mood={success?'happy':'welcome'}/></button><div className="companion-bubble" key={greeting}>{admin?(greeting%2?'辛苦啦，一起照顾好花园。':'欢迎园丁回来，今天也一起守护花园！'):success?'欢迎加入！伙伴们已经准备好啦。':greeting%2?'慢慢来，我帮你照看花园。':'准备好就一起出发！'}</div><div className="auth-seed-tags" aria-hidden="true"><span>a</span><span>o</span><span>e</span></div></aside><footer className="auth-scene-footer"><SiteIcon name="book"/> 让每一次小进步，都在花园里留下足迹</footer></main></div>;
}
