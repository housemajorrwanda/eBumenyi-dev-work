import CallList from '@/components/CallList';
import { Calendar } from 'lucide-react';

const UpcomingPage = () => {
  return (
    <section className="flex w-full flex-col gap-6 text-white sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-1/20">
          <Calendar size={20} className="text-blue-2" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Upcoming Meetings</h1>
      </div>

      <CallList type="upcoming" />
    </section>
  );
};

export default UpcomingPage;
