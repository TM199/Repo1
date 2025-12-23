import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ICPProfile } from '@/types';
import { ICPProfileDetail } from './ICPProfileDetail';

export default async function ICPProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile, error } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user?.id)
    .single();

  if (error || !profile) {
    notFound();
  }

  return <ICPProfileDetail profile={profile as ICPProfile} />;
}
