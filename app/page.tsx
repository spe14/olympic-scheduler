import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Olympic Scheduler</h1>
      <p>Plan your LA 2028 Olympics attendance with friends</p>
      <Link href="/auth/login">Login</Link>
    </main>
  );
}
