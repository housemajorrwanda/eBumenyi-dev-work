'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface HomeCardProps {
  className?: string;
  img: string;
  title: string;
  description: string;
  handleClick?: () => void;
  variant?: 'primary' | 'blue' | 'purple' | 'yellow' | 'teal';
}

const HomeCard = ({
  className,
  img,
  title,
  description,
  handleClick,
  variant = 'primary'
}: HomeCardProps) => {
  // Google Meet inspired color variants
  const variants = {
    primary: 'bg-gradient-to-br from-blue-1 to-blue-3 hover:from-blue-3 hover:to-blue-1',
    blue: 'bg-gradient-to-br from-[#1a73e8] to-[#4285f4] hover:from-[#1557b0] hover:to-[#1a73e8]',
    purple: 'bg-gradient-to-br from-[#9334e6] to-[#a855f7] hover:from-[#7c3aed] hover:to-[#9334e6]',
    yellow: 'bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] hover:from-[#d97706] hover:to-[#f59e0b]',
    teal: 'bg-gradient-to-br from-[#00796b] to-[#009688] hover:from-[#00695c] hover:to-[#00796b]',
  };

  return (
    <section
      className={cn(
        'home-card group relative overflow-hidden rounded-lg p-4 sm:rounded-2xl sm:p-6 cursor-pointer transition-all duration-300',
        'flex flex-col justify-between min-h-[160px] xs:min-h-[180px] sm:min-h-[200px] md:min-h-[220px]',
        'active:scale-95 sm:hover:scale-[1.02] sm:hover:shadow-xl sm:active:scale-[0.98]',
        'touch-target',
        variants[variant],
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick?.();
        }
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-8 -top-8 size-24 rounded-full bg-white/20 sm:size-32" />
        <div className="absolute -bottom-4 -left-4 size-20 rounded-full bg-white/10 sm:size-24" />
      </div>

      {/* Icon */}
      <div className="relative z-10 flex size-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm transition-transform xs:size-11 sm:size-12 sm:rounded-xl group-active:scale-95 sm:group-hover:scale-110">
        <Image
          src={img}
          alt={title}
          width={24}
          height={24}
          className="brightness-0 invert"
          priority
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mt-2 sm:mt-4 flex-1">
        <h2 className="text-base font-semibold text-white xs:text-lg sm:text-xl md:text-2xl line-clamp-2">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-white/80 xs:text-sm sm:mt-1 sm:text-base line-clamp-2">
          {description}
        </p>
      </div>

      {/* Arrow indicator - hide on very small screens, show on hover for desktop */}
      <div className="hidden sm:block absolute bottom-4 right-4 translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
        <svg
          className="size-6 text-white/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </div>

      {/* Mobile tap indicator */}
      <div className="sm:hidden absolute top-2 right-2 size-2 rounded-full bg-white/40" />
    </section>
  );
};

export default HomeCard;
