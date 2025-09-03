import { createFileRoute } from '@tanstack/react-router'
import { orpc } from '@/utils/orpc'
import { useQuery } from '@tanstack/react-query'
import { useLogin, useLogout, useSession } from '@/hooks/useAuth'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `

function HomeComponent() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions())
  const { data: session, isLoading: authLoading } = useSession()
  const { login, isPending: loggingIn } = useLogin()
  const { logout, isPending: loggingOut } = useLogout()

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${healthCheck.data
                ? 'bg-green-500'
                : 'bg-red-500'}`}
            />
            <span className="text-sm text-muted-foreground">
              {healthCheck.isLoading
                ? 'Checking...'
                : healthCheck.data
                  ? 'Connected'
                  : 'Disconnected'}
            </span>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Auth Demo</h2>
          {(() => {
            if (authLoading) {
              return (
                <div className="text-sm text-muted-foreground">Loading session...</div>
              )
            }
            if (session) {
              return (
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <div className="font-medium">{session.user.name}</div>
                    <div className="text-muted-foreground">{session.user.email}</div>
                  </div>
                  <button
                    className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
                    onClick={() => logout()}
                    disabled={loggingOut}
                  >
                    {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              )
            }
            return (
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">You are not logged in.</div>
                <button
                  className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
                  onClick={() => login()}
                  disabled={loggingIn}
                >
                  {loggingIn ? 'Redirecting…' : 'Login with Google'}
                </button>
              </div>
            )
          })()}
        </section>
      </div>
    </div>
  )
}
