import { Metadata } from 'next';
import { ReactNode } from 'react';

import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'RBC Meetings',
  description: 'Premium video conferencing for teams. Start instant meetings, schedule calls, and collaborate seamlessly.',
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <main className="relative h-screen overflow-hidden bg-dark-1">
      <Navbar />

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        <Sidebar />

        <section className="flex flex-1 flex-col overflow-y-auto px-0 pb-8 pt-6 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8">
          <div className="w-full max-w-none lg:mx-auto lg:max-w-7xl">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
};

export default RootLayout;
