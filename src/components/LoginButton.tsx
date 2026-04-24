"use client";

import { usePrivy } from "@privy-io/react-auth";

export function LoginButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return <div className="text-sm text-zinc-500">Loading...</div>;
  }

  if (authenticated) {
    const phone = user?.phone?.number;
    const email = user?.email?.address;

    return (
      <div className="flex flex-col gap-2 p-4 border rounded">
        <div className="text-sm">
          Signed in as <strong>{phone ?? email ?? "unknown"}</strong>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700"
    >
      Sign in with phone
    </button>
  );
}