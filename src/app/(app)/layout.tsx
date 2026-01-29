import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { getTaskCounts } from '@/app/actions/tasks'
import { Toaster } from '@/components/ui/sonner'
import { WalkthroughWrapper } from '@/components/onboarding/walkthrough-wrapper'
import { SWRProvider } from '@/lib/swr-provider'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: taskCounts } = await getTaskCounts()
  const totalTasks = taskCounts?.total ?? 0

  return (
    <SWRProvider>
      <WalkthroughWrapper>
        <div className="min-h-screen bg-background">
          <Navbar email={user.email || ''} taskCount={totalTasks} />
          <main className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </main>
          <Toaster position="bottom-right" />
        </div>
      </WalkthroughWrapper>
    </SWRProvider>
  )
}
