'use client';

/**
 * Coming Soon · 预发布登陆页
 *
 * 不让访客看到真站,但展示品牌 + 产品定位 + 社交关注引导
 * 自己用 ?preview=KEY 绕过 → 服务端 middleware 写 cookie → 全站解锁
 */
import { useState } from 'react';
import Link from 'next/link';
import { Lock, Mail } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

const TWITTER = 'https://x.com/Ocufi_io';
const TG = 'https://t.me/ocufi';
const GITHUB = 'https://github.com/rowanrowan548-maker/ocufi-web';

export function ComingSoonScreen() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // V1 只本地标记。V2 接后端邮件订阅
    try {
      const list = JSON.parse(window.localStorage.getItem('ocufi.waitlist') || '[]');
      if (!list.includes(email)) list.push(email);
      window.localStorage.setItem('ocufi.waitlist', JSON.stringify(list));
    } catch { /* */ }
    setSubmitted(true);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16 relative overflow-hidden">
      {/* 背景品牌色光晕 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 0%, oklch(0.88 0.25 155 / 14%), transparent 70%), radial-gradient(ellipse 50% 40% at 100% 100%, oklch(0.65 0.23 25 / 6%), transparent 70%)',
        }}
      />
      {/* 微网格 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-50 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-2xl flex flex-col items-center text-center gap-6">
        {/* 品牌锁层 */}
        <div className="flex items-center gap-3 mb-4">
          <Logo variant="full" size={56} />
        </div>

        {/* 状态徽章 */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs font-mono text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          PRELAUNCH · COMING SOON
        </div>

        {/* 主标语 */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight font-heading leading-[1.05]">
          链上交易,
          <br />
          应该回到你手里。
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
          Ocufi 是一个**非托管 · 低费 · 透明 · 开源**的 Solana 链上交易终端。
          竞品收 1% 手续费,我们只收 0.1%。
        </p>

        {/* 4 个差异化点 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full pt-4">
          <FeatureChip label="0.1% 手续费" />
          <FeatureChip label="非托管" />
          <FeatureChip label="开源审计" />
          <FeatureChip label="链上即时" />
        </div>

        {/* 等待名单(本地存档,V2 上邮件订阅) */}
        <div className="w-full max-w-md pt-4">
          {submitted ? (
            <div className="rounded-md border border-success/30 bg-success/5 p-4 text-sm text-success">
              ✓ 已加入早鸟列表,上线第一时间通知你
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="你的邮箱 · 上线就通知你"
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-border/60 bg-background text-sm focus:outline-none focus:border-primary/50"
                  required
                />
              </div>
              <Button type="submit" className="h-11 px-5">
                早鸟登记
              </Button>
            </form>
          )}
        </div>

        {/* 社交关注 */}
        <div className="flex flex-col items-center gap-3 pt-6 border-t border-border/40 w-full max-w-md mt-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            关注更新
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <SocialLink href={TWITTER} label="𝕏 @Ocufi_io" />
            <SocialLink href={TG} label="✈ Telegram" />
            <SocialLink href={GITHUB} label="GitHub" />
          </div>
        </div>

        {/* 法律链接占位 */}
        <div className="flex gap-3 text-[10px] text-muted-foreground/50 mt-4 flex-wrap justify-center">
          <Link href="/legal/privacy" className="hover:text-muted-foreground">隐私</Link>
          <span>·</span>
          <Link href="/legal/terms" className="hover:text-muted-foreground">条款</Link>
          <span>·</span>
          <Link href="/legal/disclaimer" className="hover:text-muted-foreground">免责</Link>
        </div>

        <div className="text-[10px] font-mono text-muted-foreground/40 mt-2 inline-flex items-center gap-1">
          <Lock className="h-2.5 w-2.5" />
          有访问密钥?在 URL 后加 <span className="text-foreground/70">?preview=你的密钥</span>
        </div>
      </div>
    </main>
  );
}

function FeatureChip({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/50 px-3 py-2 text-xs text-foreground/90">
      {label}
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors text-sm"
    >
      {label}
    </a>
  );
}
