'use client';

import { useState, useEffect } from 'react';
import MeetingTypeList from '@/components/MeetingTypeList';

const Home = () => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }));
      setDate(new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(now));

      // Set greeting based on time of day
      const hour = now.getHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 18) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="flex w-full flex-col gap-4 text-white sm:gap-6 md:gap-8 lg:gap-10">
      {/* Hero Section - Google Meet Style */}
      <div className="home-page-hero relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-dark-2 to-dark-3 p-4 sm:rounded-2xl sm:p-6 md:rounded-3xl md:p-8 lg:p-10">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 size-40 rounded-full bg-blue-1/10 blur-3xl sm:size-64 lg:size-80" />
          <div className="absolute -bottom-32 -left-32 size-60 rounded-full bg-purple-1/10 blur-3xl sm:size-80 lg:size-96" />
          <div className="absolute right-1/4 top-1/2 size-32 rounded-full bg-meet-green/10 blur-2xl sm:size-40 lg:size-56" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-3 sm:gap-4 md:gap-6">
          {/* Greeting badge */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-1/20 px-3 py-1.5 backdrop-blur-sm sm:px-4 sm:py-2">
            <span className="size-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-xs font-medium text-blue-2 sm:text-sm">{greeting}</span>
          </div>

          {/* Time display */}
          <div className="flex flex-col gap-1 sm:gap-2">
            <h1 className="meeting-time text-3xl font-bold tracking-tight text-white xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
              {time}
            </h1>
            <p className="text-xs text-white/60 sm:text-sm md:text-base lg:text-lg">
              {date}
            </p>
          </div>

          {/* Quick stats or message */}
          <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-dark-1/50 px-2.5 py-1.5 backdrop-blur-sm sm:px-3 sm:py-2">
              <svg className="size-3 text-blue-2 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-white/80 sm:text-sm">Premium meetings</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-dark-1/50 px-2.5 py-1.5 backdrop-blur-sm sm:px-3 sm:py-2">
              <svg className="size-3 text-green-400 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-white/80 sm:text-sm">Secure & private</span>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Type Cards */}
      <MeetingTypeList />
    </section>
  );
};

export default Home;
