'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteProfileButtonProps {
  profileId: string;
}

export function DeleteProfileButton({ profileId }: DeleteProfileButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this search profile? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/search/profiles/${profileId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/search');
        router.refresh();
      } else {
        alert('Failed to delete profile');
        setDeleting(false);
      }
    } catch (error) {
      alert('Failed to delete profile');
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="destructive"
      onClick={handleDelete}
      disabled={deleting}
      className="bg-[#CD3D64] hover:bg-[#B83558] text-white"
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 mr-2" />
      )}
      Delete
    </Button>
  );
}
