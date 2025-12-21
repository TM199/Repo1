import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SourceCard } from '@/components/dashboard/SourceCard';
import { Button } from '@/components/ui/button';
import { Source } from '@/types';
import { Plus } from 'lucide-react';

export default async function SourcesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sources</h1>
        <Link href="/sources/add">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {sources && sources.length > 0 ? (
          sources.map((source) => (
            <SourceCard key={source.id} source={source as Source} />
          ))
        ) : (
          <p className="text-muted-foreground py-8 text-center">
            No sources yet. Add your first source to start tracking signals.
          </p>
        )}
      </div>
    </div>
  );
}
