'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <Card className="border-[#E3E8EE] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] bg-white">
      <CardHeader className="text-center pb-6">
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
          <Zap className="h-6 w-6 text-[#635BFF]" />
        </div>
        <CardTitle className="text-2xl text-[#0A2540] font-semibold">Welcome back</CardTitle>
        <CardDescription className="text-[#6B7C93]">
          Sign in to your Signal Tracker account
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

          <Button
            type="submit"
            className="w-full h-11 bg-[#635BFF] hover:bg-[#5851ea] text-white font-medium shadow-sm transition-all duration-200 hover:shadow-md"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          <p className="text-center text-sm text-[#6B7C93] pt-2">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#635BFF] hover:text-[#5851ea] font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
