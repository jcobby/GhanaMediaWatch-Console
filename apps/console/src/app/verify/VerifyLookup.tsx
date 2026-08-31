'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui';

/** Codes are stamped uppercase; typing them lowercase must still work. */
export function VerifyLookup() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const normalised = code.trim().toUpperCase().replace(/\s+/g, '');
  const valid = /^DW-[0-9A-Z]{3}-[0-9A-Z]{3}$/.test(normalised);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/verify/${normalised}`);
      }}
      className="space-y-3"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="DW-XXX-XXX"
          aria-label="Report code"
          autoCapitalize="characters"
          className="h-12 w-full rounded-md border border-hairline/15 bg-canvas-soft pl-10 pr-4 text-center font-mono text-lg tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-text-faint focus:border-accent"
        />
      </div>
      <Button type="submit" size="lg" fullWidth disabled={!valid}>
        Check this report
      </Button>
    </form>
  );
}
