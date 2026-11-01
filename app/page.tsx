import { redirect } from "next/navigation";

// The game lives at /dashboard. Anyone who isn't signed in is sent on to
// /login from there.
export default function Home() {
  redirect("/dashboard");
}