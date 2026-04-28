'use client';

/**
 * T-964 #152 · footer 显前端/后端 commit + 构建时间
 *
 * 前端 commit:Vercel 注入 NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA + NEXT_PUBLIC_BUILD_TIME
 * 后端 commit:GET /version(T-960 后端 ship)· 失败静默
 */
import { useEffect, useState } from 'react';
import { fetchBackendVersion, isApiConfigured, type VersionInfo } from '@/lib/api-client';

const FE_COMMIT = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);
const FE_BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? '';

function formatBuildTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}Z`;
  } catch { return ''; }
}

export function FooterVersion() {
  const [be, setBe] = useState<VersionInfo | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    fetchBackendVersion()
      .then((v) => { if (!cancelled) setBe(v); })
      .catch(() => { /* 静默 · /version 没起也不报错 */ });
    return () => { cancelled = true; };
  }, []);

  const feShort = FE_COMMIT || '—';
  const feTime = formatBuildTime(FE_BUILD_TIME);
  const beShort = be?.commit?.slice(0, 7) ?? null;
  const beTime = be?.build_time ? formatBuildTime(be.build_time) : '';

  return (
    <span className="text-muted-foreground/60">
      <span title={`前端 commit · build ${feTime}`}>fe {feShort}</span>
      {beShort && (
        <>
          {' · '}
          <span title={`后端 commit · build ${beTime}`}>be {beShort}</span>
        </>
      )}
    </span>
  );
}
