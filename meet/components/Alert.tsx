import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, Home } from 'lucide-react';

import { Button } from './ui/button';

interface AlertProps {
  title: string;
  iconUrl?: string;
}

const Alert = ({ title, iconUrl }: AlertProps) => {
  return (
    <section className="flex-center h-screen w-full bg-dark-1 px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-dark-3 bg-dark-2 p-8 text-center shadow-meet-lg">
        {/* Icon */}
        <div className="flex size-20 items-center justify-center rounded-full bg-meet-red/20">
          {iconUrl ? (
            <Image src={iconUrl} width={40} height={40} alt="alert icon" />
          ) : (
            <AlertCircle size={40} className="text-meet-red" />
          )}
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            {title}
          </h2>
          <p className="text-sm text-white/50">
            Please check the meeting details or try again later
          </p>
        </div>

        {/* Action button */}
        <Button
          asChild
          className="h-12 w-full gap-2 rounded-full bg-blue-1 px-6 font-medium text-white transition-all hover:bg-blue-3 hover:shadow-lg"
        >
          <Link href="/">
            <Home size={18} />
            Back to Home
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default Alert;
