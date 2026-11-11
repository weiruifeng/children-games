import { resources } from '../resources/manager';
import { useResources } from '../resources/useResources';
import { ResourceLoader } from '../resources/ResourceLoader';
import { useEffect, useState } from 'react';
import { GardenApp } from '../experiments/pinyin-garden/GardenApp';
import { api, me, type User } from './api';
import { AuthPanel } from './AuthPanel';
import { Admin } from './Admin';
import { GardenRepository } from './repository';
import { ParentSettings } from './ParentSettings';
import { SiteHeader, SiteNotice, useSiteMotion } from './SitePrimitives';
import './site.css';
export function SiteApp() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [repo, setRepo] = useState<GardenRepository | null>(null),
    [message, setMessage] = useState(''),
    [epoch, setEpoch] = useState(0),
    [, refresh] = useState(0),
    [manage, setManage] = useState(false);
  const admin = location.pathname.startsWith('/admin');
  const motion = useSiteMotion();
  const [assetRetry, setAssetRetry] = useState(0);
  const shell = useResources(resources.group('garden-shell'), 'site-shell', assetRetry);
  useEffect(() => {
    void me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user || admin) return;
    const r = new GardenRepository(user.id);
    let cancelled = false;
    r.onChange = () => refresh((n) => n + 1);
    void r
      .start()
      .then(() => {
        if (!cancelled) setRepo(r);
      })
      .catch((e) => setMessage(String(e)));
    const online = () => void r.retry();
    window.addEventListener('online', online);
    return () => {
      cancelled = true;
      setRepo(null);
      window.removeEventListener('online', online);
      void r.dispose();
    };
  }, [user, admin]);
  async function logout() {
    await repo?.retry();
    await api('/auth/logout', {});
    await repo?.dispose();
    setRepo(null);
    setManage(false);
    setUser(null);
  }
  const preparingSave = !!user && !admin && !repo && !message;
  if (shell.phase !== 'ready' || loading || preparingSave)
    return (
      <div className={motion.reduced ? 'reduced-motion' : ''}>
        <ResourceLoader
          delayMs={shell.phase === 'ready' ? 600 : 200}
          progress={shell.phase === 'ready' ? { ...shell, phase: 'loading' } : shell}
          message={
            shell.phase !== 'ready' ? undefined : loading ? '正在确认账号…' : '正在打开存档…'
          }
          onRetry={() => setAssetRetry((n) => n + 1)}
          onBack={() => location.assign('/')}
          title="正在打开花园"
        />
      </div>
    );
  if (!user) return <AuthPanel admin={admin} onLogin={setUser} />;
  const blocked = repo && ['auth-required', 'conflict', 'error'].includes(repo.status);
  return (
    <div className={`site-world ${motion.reduced ? 'reduced-motion' : ''}`}>
      {admin && (
        <SiteHeader>
          <span className="account-name">{user.username}</span>
          {(admin || user.role === 'admin') && (
            <a className="site-button" href={admin ? '/garden/' : '/admin/'}>
              {admin ? '进入花园' : '管理后台'}
            </a>
          )}
          <button className="site-button" onClick={() => setManage(true)}>
            账号设置
          </button>
        </SiteHeader>
      )}
      {message && <SiteNotice kind="error">{message}</SiteNotice>}
      {manage && (
        <ParentSettings
          user={user}
          repo={repo}
          onClose={() => setManage(false)}
          onLogin={(u) => {
            setUser(u);
            if (!u) {
              setRepo(null);
              setManage(false);
            }
          }}
          onChanged={() => setEpoch((n) => n + 1)}
          onLogout={logout}
        />
      )}{' '}
      {blocked && !manage && (
        <div className="site-ui site-panel">
          <SiteNotice>花园存档需要家长处理：{repo?.message}</SiteNotice>
          <button className="site-button site-primary" onClick={() => setManage(true)}>
            查看存档问题
          </button>
        </div>
      )}
      {admin ? (
        user.role === 'admin' ? (
          <Admin />
        ) : (
          <main className="site-ui site-panel">
            当前账号没有管理权限。请进入花园，或在账号设置中退出后使用管理员账号登录。
          </main>
        )
      ) : repo ? (
        <GardenApp
          key={user.id + ':' + epoch}
          store={repo}
          onAccount={() => setManage(true)}
          cloudBlocked={!!blocked || manage}
        />
      ) : (
        <main className="site-ui site-panel">{message || '正在准备存档…'}</main>
      )}
    </div>
  );
}
