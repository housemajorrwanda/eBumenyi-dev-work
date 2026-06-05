'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { LogOut, User, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

import MobileNav from './MobileNav';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    window.location.href = '/sign-in';
  };

  return (
    <nav className="flex-between h-16 w-full border-b border-dark-3/30 bg-dark-1 px-3 py-2.5 backdrop-blur-lg sm:px-6 sm:py-3 lg:px-10">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
        <Image
          src="/icons/logo.svg"
          width={32}
          height={32}
          alt="logo"
          className="size-7 sm:size-8 lg:size-9"
        />
        <p className="text-lg font-semibold tracking-tight text-white max-sm:hidden sm:text-xl lg:text-2xl">
          RBC Meeting
        </p>
      </Link>

      {/* Right side actions */}
      <div className="flex-between gap-2 sm:gap-3 lg:gap-5">
        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center size-8 sm:size-9 lg:size-10 rounded-full hover:bg-dark-2 transition-all duration-200 border border-dark-3/50 hover:border-blue-1/30"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            // sun icon when currently dark; lighten for contrast against dark bg
            <Sun size={16} className="text-yellow-300 sm:size-18 lg:size-18" />
          ) : (
            // moon icon when currently light; darker blue with a subtle light circle behind it for contrast
            <span className="relative">
              <span className="absolute inset-0 rounded-full bg-white/30" />
              <Moon size={16} className="text-blue-2 sm:size-18 lg:size-18 relative" />
            </span>
          )}
        </button>

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-full hover:bg-dark-2 transition-all duration-200 border border-dark-3/50 hover:border-blue-1/30">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name || 'User avatar'}
                  width={40}
                  height={40}
                  className="size-8 sm:size-9 lg:size-10 rounded-full object-cover shadow-lg hover:shadow-xl transition-shadow"
                />
              ) : (
                <div className="flex items-center justify-center size-8 sm:size-9 lg:size-10 rounded-full bg-gradient-to-br from-blue-1 to-blue-2 text-white font-bold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-shadow">
                  {user.name?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 sm:w-64 bg-dark-2 border border-dark-3 shadow-xl">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-1/10 to-blue-2/10 border-b border-dark-3">
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-xs text-white/70 mt-1">{user.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-dark-3/50" />
              <DropdownMenuItem disabled className="text-xs text-white/60 flex items-center gap-3 px-4 py-2.5 hover:bg-dark-3/30">
                <div className="flex items-center justify-center size-6 rounded-md bg-blue-1/20">
                  <User size={14} className="text-blue-1" />
                </div>
                <span className="font-medium">{user.role || 'User'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-dark-3/50" />
              <DropdownMenuItem onClick={handleLogout} className="text-red-500 cursor-pointer flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors">
                <LogOut size={16} />
                <span className="font-medium">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Mobile navigation */}
        <MobileNav />
      </div>
    </nav>
  );
};

export default Navbar;
