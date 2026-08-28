import { Nav } from "@/components/Nav";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="px-4 py-10">
        <AuthForm mode="login" />
      </main>
    </div>
  );
}
