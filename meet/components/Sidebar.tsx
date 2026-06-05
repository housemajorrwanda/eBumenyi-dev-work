'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { sidebarLinks } from '@/constants';
import { cn } from '@/lib/utils';

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <section 
      className="hidden h-full w-fit flex-col justify-between overflow-y-auto bg-dark-1 p-4 pt-4 text-white sm:flex lg:w-[264px] lg:p-6 lg:pt-6"
      data-sidebar="main"
    >      <div className="flex flex-1 flex-col gap-2">
        {sidebarLinks.map((item) => {
          const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);

          return (
            <Link
              href={item.route}
              key={item.label}
              className={cn(
                'group flex gap-4 items-center p-3 lg:p-4 rounded-xl justify-start transition-all duration-300 cursor-pointer',
                isActive
                  ? 'bg-blue-1 text-white shadow-lg'
                  : 'text-white/70 hover:bg-dark-2/60 hover:text-white/90 hover:shadow-md'
              )}
            >
              <div className={cn(
                'flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
                isActive && 'scale-110'
              )}>
                <Image
                  src={item.imgURL}
                  alt={item.label}
                  width={24}
                  height={24}
                  className={cn(
                    'transition-all duration-300',
                    isActive ? 'brightness-100' : 'brightness-75 group-hover:brightness-100'
                  )}
                />
              </div>
              <p className={cn(
                'text-base font-medium max-lg:hidden transition-colors duration-300',
                isActive ? 'text-white' : 'text-white/70 group-hover:text-white'
              )}>
                {item.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Version info at bottom */}
      <div className="border-t border-dark-3 pt-4 mt-auto">
        <p className="text-xs text-white/40">RBC meeting v1.0</p>
      </div>
    </section>
  );
};

export default Sidebar;
