'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { sidebarLinks } from '@/constants';
import { cn } from '@/lib/utils';

const MobileNav = () => {
  const pathname = usePathname();

  return (
    <section className="sm:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex size-10 items-center justify-center rounded-full bg-dark-3 text-white transition-colors hover:bg-dark-4">
            <Menu size={22} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] border-r border-dark-3 bg-dark-1 p-0">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-dark-3 p-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/icons/logo.svg"
                width={32}
                height={32}
                alt="logo"
              />
              <p className="text-xl font-semibold text-white">Meeting</p>
            </Link>
          </div>

          {/* Navigation links */}
          <div className="flex h-[calc(100vh-72px)] flex-col justify-between overflow-y-auto p-4">
            <nav className="flex flex-col gap-2">
              {sidebarLinks.map((item) => {
                const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);

                return (
                  <SheetClose asChild key={item.route}>
                    <Link
                      href={item.route}
                      className={cn(
                        'flex items-center gap-4 rounded-xl p-3 transition-all duration-200',
                        isActive
                          ? 'bg-blue-1 text-white'
                          : 'text-white/70 hover:bg-dark-3 hover:text-white'
                      )}
                    >
                      <Image
                        src={item.imgURL}
                        alt={item.label}
                        width={22}
                        height={22}
                        className={cn(
                          'transition-all',
                          !isActive && 'brightness-75'
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="border-t border-dark-3 pt-4">
              <p className="text-xs text-white/40">Meeting v1.0</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export default MobileNav;
