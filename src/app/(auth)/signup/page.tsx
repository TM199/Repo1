'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, Check } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <Card className="border-[#E3E8EE] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] bg-white">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[#D1FAE5] flex items-center justify-center">
            <Check className="h-6 w-6 text-[#0BBF7D]" />
          </div>
          <h3 className="text-xl font-semibold text-[#0A2540] mb-2">Check your email</h3>
          <p className="text-[#6B7C93] text-sm mb-6">
            We&apos;ve sent a confirmation link to <strong className="text-[#0A2540]">{email}</strong>
          </p>
          <Link href="/login">
            <Button variant="outline" className="border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]">
              Back to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E3E8EE] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] bg-white">
      <CardHeader className="text-center pb-6">
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[#D1FAE5] flex items-center justify-center">
          <Zap className="h-6 w-6 text-[#0BBF7D]" />
        </div>
        <CardTitle className="text-2xl text-[#0A2540] font-semibold">Create account</CardTitle>
        <CardDescription className="text-[#6B7C93]">
          Get started with Signal Tracker
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-[#CD3D64] bg-[#FEE2E2] rounded-lg border border-[#FECACA]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#0A2540] text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#0A2540] text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-[#0A2540] text-sm font-medium">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-[#0BBF7D] hover:bg-[#0AAD71] text-white font-medium shadow-sm transition-all duration-200 hover:shadow-md"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <p className="text-center text-sm text-[#6B7C93] pt-2">
            Already have an account?{' '}
            <Link href="/login" className="text-[#635BFF] hover:text-[#5851ea] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
