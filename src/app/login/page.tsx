import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
