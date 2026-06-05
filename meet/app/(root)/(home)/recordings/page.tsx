import CallList from '@/components/CallList';
import { PlayCircle } from 'lucide-react';

const RecordingsPage = () => {
  return (
    <section className="flex w-full flex-col gap-6 text-white sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-yellow-1/20">
          <PlayCircle size={20} className="text-yellow-1" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Recordings</h1>
      </div>

      <CallList type="recordings" />
    </section>
  );
};

export default RecordingsPage;
