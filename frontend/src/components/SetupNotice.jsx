import { Settings2 } from 'lucide-react'
import { missingFirebaseKeys } from '../lib/firebase'

const ENV_NAMES = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

/** Shown when frontend/.env is missing Firebase config, instead of crashing. */
export default function SetupNotice() {
  return (
    <div className="bg-grid flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-900/80 p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <Settings2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Firebase isn&apos;t configured yet</h1>
        </div>
        <p className="text-sm text-zinc-400">
          Copy <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">frontend/.env.example</code> to{' '}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">frontend/.env</code>, paste your Firebase web-app
          config, then restart <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">npm run dev</code>.
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Missing values</p>
        <ul className="mt-2 space-y-1 font-mono text-sm text-rose-300">
          {missingFirebaseKeys.map((k) => (
            <li key={k}>• {ENV_NAMES[k] || k}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

