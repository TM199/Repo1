import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function LabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-semibold text-gray-900">
              Signal Mentis
            </Link>
            <Badge variant="secondary">Labs</Badge>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Back to App
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t px-6 py-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          These features are experimental and may not work reliably.
          Data shown here is not saved to your account.
        </div>
      </footer>
    </div>
  );
}
