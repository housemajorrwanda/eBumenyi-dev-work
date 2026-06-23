import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, AlertCircle, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthDecorativePanel } from "@/components/auth/AuthDecorativePanel";
import { forgotPassword } from "@/services/auth.service";
import { ForgotPasswordSchema } from "@/schemas/auth.schema";
import { IResetPasswordRequest } from "@/types/auth";

interface DarkFieldProps {
  label: string;
  placeholder: string;
  type?: string;
  icon: React.ReactNode;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reg: any;
}

const DarkField: React.FC<DarkFieldProps> = ({ label, placeholder, type = "text", icon, error, reg }) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 border rounded-xl px-4 py-3.5 transition-colors ${
          error ? "border-red-500/50 bg-[#1f1535]" : "bg-[#1c1f2e] border-white/[0.08] focus-within:border-[#3363AD]/70"
        }`}
      >
        <span className={`flex-shrink-0 ${error ? "text-red-400" : "text-gray-500"}`}>
          {icon}
        </span>
        <input
          {...reg}
          type={type}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-base placeholder:text-gray-600 outline-none min-w-0"
        />
      </div>
      {error && <p className="text-sm text-red-400 pl-1">{error}</p>}
    </div>
  );
};

export const ForgotPassword: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IResetPasswordRequest>({ resolver: zodResolver(ForgotPasswordSchema) });

  const onSubmit = async (data: IResetPasswordRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
    } catch (err) {
      setError((err as { message?: string })?.message || "Failed to send reset link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-0 lg:p-3"
      style={{ background: "#0e0a1f" }}
    >
      <div
        className="w-full min-h-screen lg:min-h-0 lg:h-[calc(100vh-24px)] flex overflow-hidden"
        style={{
          borderRadius: "clamp(0px, (100vw - 768px) * 9999, 18px)",
          background: "#111827",
          boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(51,99,173,0.12)",
        }}
      >
        <AuthDecorativePanel />

        {/* Right — form */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto relative"
          style={{ background: "#111827" }}
        >
          {/* Brand (mobile only) */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <img src="/chw.png" alt="eBumenyi" className="w-7 h-7 object-contain" />
            <span className="text-white font-bold text-sm">eBumenyi</span>
          </div>

          <div className="w-full max-w-[480px]">
            {!isSubmitted ? (
              <>
                {/* Header */}
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-white mb-1.5">Forgot password?</h1>
                  <p className="text-base text-gray-500">No worries, we'll send you reset instructions</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <DarkField
                    label="Email Address"
                    placeholder="you@example.com"
                    type="email"
                    icon={<Mail size={16} />}
                    error={errors.email?.message}
                    reg={register("email")}
                  />

                  {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-300">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#3363AD] hover:bg-[#2a52a0] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 text-base rounded-xl transition-colors flex items-center justify-center gap-2 mt-6"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>

                  <Link
                    to="/auth/login"
                    className="flex items-center justify-center gap-2 text-sm text-[#4a90d9] hover:text-[#6aaae8] transition-colors mt-4"
                  >
                    <ArrowLeft size={16} />
                    Back to login
                  </Link>
                </form>
              </>
            ) : (
              <>
                {/* Success State */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-400" />
                    </div>
                  </div>

                  <h1 className="text-3xl font-bold text-white mb-3">Check your email</h1>
                  <p className="text-base text-gray-500 mb-6">
                    We've sent a password reset link to<br />
                    <span className="text-white font-medium">{submittedEmail}</span>
                  </p>

                  <div className="bg-[#1c1f2e] border border-white/[0.08] rounded-xl p-4 mb-6">
                    <p className="text-sm text-gray-400">
                      Didn't receive the email? Check your spam folder or{" "}
                      <button
                        onClick={() => setIsSubmitted(false)}
                        className="text-[#4a90d9] hover:text-[#6aaae8] transition-colors"
                      >
                        try again
                      </button>
                    </p>
                  </div>

                  <Link
                    to="/auth/login"
                    className="flex items-center justify-center gap-2 text-sm text-[#4a90d9] hover:text-[#6aaae8] transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Back to login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page footer */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-700 whitespace-nowrap">
        © {new Date().getFullYear()} eBumenyi · Ministry of Health, Rwanda
      </p>
    </div>
  );
};
