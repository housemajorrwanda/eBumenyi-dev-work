import CallList from "@/components/CallList";
import { History } from 'lucide-react';

const PreviousPage = () => {
  return (
    <section className="flex w-full flex-col gap-6 text-white sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-dark-3">
          <History size={20} className="text-white/70" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Previous Calls</h1>
      </div>

      <CallList type="ended" />
    </section>
  );
};

export default PreviousPage;
