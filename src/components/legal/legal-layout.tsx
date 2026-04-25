import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Section {
  heading: string;
  body: string;
}

interface Props {
  title: string;
  lastUpdated: string;
  sections: Section[];
}

/**
 * 法律页统一外壳:
 *  - 标题 + 上次更新日期
 *  - 分节渲染,body 自动按 \n\n 段落分隔
 *  - 顶部回首页链接
 *
 * 不接受任何外部 HTML,sections 全部走纯文本路径,自然防 XSS
 */
export function LegalLayout({ title, lastUpdated, sections }: Props) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Ocufi
        </Link>

        <header className="space-y-2 border-b border-border/40 pb-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">{lastUpdated}</p>
        </header>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {i + 1}. {s.heading}
              </h2>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
                {s.body.split(/\n\n+/).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="pt-8 border-t border-border/40 text-xs text-muted-foreground/70">
          有任何疑问可以发邮件到 <span className="font-mono">support@ocufi.io</span>(占位地址,V2 启用)
        </footer>
      </div>
    </main>
  );
}
