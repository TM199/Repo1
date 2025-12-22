import { createClient } from '@/lib/supabase/server';
import { SignalsPageClient } from './SignalsPageClient';

export default async function SignalsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in</div>;
  }

  // Client component handles its own data fetching with filters
  return <SignalsPageClient />;
}
