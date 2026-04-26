'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import { Search, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function TokenSearchForm() {
  const t = useTranslations();
  const router = useRouter();
  const [mint, setMint] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = mint.trim();
    try {
      new PublicKey(m);
      if (m.length < 32 || m.length > 44) throw new Error();
    } catch {
      setErr(t('trade.errors.invalidMint'));
      return;
    }
    router.push(`/trade?mint=${m}`);
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Input
            placeholder="Token mint address"
            value={mint}
            onChange={(e) => { setMint(e.target.value); setErr(null); }}
            className="font-mono text-sm"
            autoFocus
          />
          {err && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <Button type="submit" className="w-full">
            <Search className="mr-2 h-4 w-4" />
            {t('token.search.button')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
