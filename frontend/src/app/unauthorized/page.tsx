import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Unauthorized Access</h1>
        <p className="text-sm text-muted-foreground">
          Role aktif Anda tidak sesuai dengan halaman yang dibuka. Silakan pindah role atau kembali ke dashboard yang benar.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/login" className="text-sm underline underline-offset-4">
            Kembali ke Login
          </Link>
        </div>
      </div>
    </main>
  );
}
