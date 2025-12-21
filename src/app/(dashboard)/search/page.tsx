import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SearchProfileCard } from '@/components/dashboard/SearchProfileCard';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { SearchProfile } from '@/types';

export default async function SearchPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">Search Profiles</h1>
          <p className="text-sm text-[#6B7C93] mt-1">
            Create and manage search profiles to find relevant signals
          </p>
        </div>
        <Link href="/search/new">
          <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Profile
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {profiles && profiles.length > 0 ? (
          profiles.map((profile) => (
            <SearchProfileCard key={profile.id} profile={profile as SearchProfile} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-[#F6F9FC] rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-[#6B7C93]" />
            </div>
            <h3 className="text-lg font-semibold text-[#0A2540] mb-2">
              No search profiles yet
            </h3>
            <p className="text-[#6B7C93] text-center max-w-md mb-6">
              Create your first search profile to start finding relevant signals based on roles, industries, and locations.
            </p>
            <Link href="/search/new">
              <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Search Profile
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
