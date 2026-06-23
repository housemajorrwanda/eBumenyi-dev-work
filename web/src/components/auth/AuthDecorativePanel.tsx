import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

const slides = [
  {
    image: "/slide1.png",
    title: "Empowering Rwanda's CHWs",
    subtitle: "Comprehensive digital training for Community Health Workers nationwide — learn at your own pace, anywhere.",
  },
  {
    image: "/slide2.png",
    title: "Learn. Grow. Heal.",
    subtitle: "Access courses, track your progress, and earn certificates on your healthcare journey with eBumenyi.",
  },
  {
    image: "/slide3.png",
    title: "Building Healthier Communities",
    subtitle: "A Government of Rwanda initiative transforming frontline healthcare delivery through technology.",
  },
];

export const AuthDecorativePanel: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden lg:block w-[46%] flex-shrink-0 p-3 self-stretch">
      <div className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col">

        {/* Photos — pure CSS crossfade via opacity transition */}
        {slides.map((s, i) => (
          <img
            key={s.image}
            src={s.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === activeSlide ? 1 : 0,
              transition: "opacity 1.2s ease-in-out",
            }}
          />
        ))}

        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.75) 100%)",
          }}
        />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-8 pt-7">
          <div className="flex items-center gap-3">
            <img src="/chw.png" alt="eBumenyi" className="w-10 h-10 object-contain drop-shadow" />
            <span className="text-white font-bold text-base tracking-tight drop-shadow">eBumenyi</span>
            <div className="w-px h-5 bg-white/35 mx-1" />
            <img
              src="/rbc-logo.png"
              alt="RBC"
              className="h-8 object-contain drop-shadow"
              style={{ filter: "brightness(1.1)" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <a
            href="https://ebumenyi.online"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full transition-all border border-white/20"
          >
            Back to website <ArrowRight size={12} />
          </a>
        </div>

        <div className="flex-1" />

        {/* Slide text — keyed so React remounts it, CSS animation plays fresh */}
        <div key={activeSlide} className="relative z-10 px-8 pb-8 text-center animate-fade-up-in">
          <h2 className="text-2xl font-bold text-white mb-2.5 leading-snug drop-shadow-lg">
            {slides[activeSlide].title}
          </h2>
          <p className="text-white/75 text-sm leading-relaxed mx-auto max-w-[300px]">
            {slides[activeSlide].subtitle}
          </p>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2.5 mt-5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  i === activeSlide ? "w-8 bg-white" : "w-3 bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
