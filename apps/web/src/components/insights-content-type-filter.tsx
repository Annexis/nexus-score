'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface InsightsContentTypeFilterProps {
  contentType: string;
  options: { type: string; label: string }[];
  explorerHref: string;
}

export function InsightsContentTypeFilter({ contentType, options, explorerHref }: InsightsContentTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(contentType);
  const [pending, startTransition] = useTransition();

  const changeContentType = (next: string) => {
    setSelected(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('contentType', next);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <form action={pathname} method="get" onSubmit={(event) => {
      event.preventDefault();
      changeContentType(selected);
    }} aria-busy={pending} className="mt-8 flex flex-col gap-3 rounded-xl border border-brand-rule bg-brand-mist p-5 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="insight-content-type" className="block text-sm font-semibold text-gray-800">Content type for these insights</label>
        <select id="insight-content-type" name="contentType" value={selected} disabled={pending}
          onChange={(event) => changeContentType(event.target.value)}
          aria-describedby="insight-filter-help"
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm disabled:opacity-60 sm:max-w-sm">
          <option value="all">All Benchmarked Content Types</option>
          {options.map((type) => <option key={type.type} value={type.type}>{type.label}</option>)}
        </select>
        <p id="insight-filter-help" className="mt-2 text-xs text-gray-500">Results update automatically when you select a content type.</p>
      </div>
      <noscript><button type="submit" className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white">Update insights</button></noscript>
      <div className="py-2.5 text-sm font-medium" aria-live="polite">
        {pending ? <span role="status" className="text-gray-600">Updating insights…</span>
          : <Link href={explorerHref} className="text-blue-700 underline">Explore this scope →</Link>}
      </div>
    </form>
  );
}
