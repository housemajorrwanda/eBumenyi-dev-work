const Loader = () => {
  return (
    <div className="flex-center h-screen w-full bg-dark-1">
      <div className="flex flex-col items-center gap-4">
        {/* Google Meet style spinner */}
        <div className="relative size-12">
          <div className="absolute inset-0 rounded-full border-4 border-dark-3"></div>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-1"></div>
        </div>
        <p className="animate-pulse text-sm text-white/60">Loading...</p>
      </div>
    </div>
  );
};

export default Loader;
