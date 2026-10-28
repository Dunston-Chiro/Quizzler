import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md mx-auto p-8 bg-white border-4 border-black font-mono font-bold text-center shadow-[8px_8px_0px_#000]">
            Loading login portal...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
