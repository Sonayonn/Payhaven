import Image from "next/image";
import { LoginButton } from "@/components/LoginButton";
export default function Home(){
  return (
    <main className="flex flex-col flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8 max-w-md w-full">
        <h1 className="text-3xl font-semibold">Payhaven</h1>
        <p className="text-zinc-600 text-center">
          Private USDC remittance.
        </p>
        <LoginButton />
      </div>
    </main>
  );
}