'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import StreamVideoProvider from '@/providers/StreamClientProvider';

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  const pathname = usePathname();

  // Meeting pages have their own StreamVideoProvider to support guest access
  const isMeetingPage = pathname?.startsWith('/meeting');

  if (isMeetingPage) {
    return <main>{children}</main>;
  }

  return (
    <main>
      <StreamVideoProvider>{children}</StreamVideoProvider>
    </main>
  );
};

export default RootLayout;
