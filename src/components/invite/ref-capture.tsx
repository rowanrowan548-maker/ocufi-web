'use client';

/**
 * URL ref= 捕获 · 全站挂载,无 UI
 *
 * 任何带 ?ref=xxx 的进站请求,首次访问就 stash 到 localStorage。
 * 后续连钱包成功 → 调后端 /invite/bind 绑定关系(后端就绪后接)
 */
import { useEffect } from 'react';
import { captureRefFromUrl } from '@/lib/invite';

export function RefCapture() {
  useEffect(() => {
    captureRefFromUrl();
  }, []);
  return null;
}
