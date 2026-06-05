'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function StaffLoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-dark-1 via-dark-2 to-dark-1 px-4">
      <div className="relative w-full max-w-md">
        {/* Background decorations */}
        <div className="absolute -left-32 -top-32 size-64 rounded-full bg-blue-1/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-64 rounded-full bg-purple-1/10 blur-3xl" />

        {/* Login card */}
        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-dark-2/50 backdrop-blur-md shadow-2xl p-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-blue-1">eBumenyi Meeting</h1>
              <p className="text-sm text-white/60">Community Health Worker Platform</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-500/10 border border-red-500/30 p-4">
                <AlertCircle size={20} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-white">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@example.com"
                  disabled={isSubmitting || isLoading}
                  required
                  className="w-full rounded-lg bg-dark-3/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-blue-1 focus:outline-none focus:ring-1 focus:ring-blue-1/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-white">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSubmitting || isLoading}
                    required
                    className="w-full rounded-lg bg-dark-3/50 border border-white/10 px-4 py-3 pr-12 text-white placeholder:text-white/40 focus:border-blue-1 focus:outline-none focus:ring-1 focus:ring-blue-1/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting || isLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isLoading || !email || !password}
                className="w-full rounded-lg bg-blue-1 hover:bg-blue-600 text-white font-semibold py-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
