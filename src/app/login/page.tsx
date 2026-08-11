import { redirect } from "next/navigation";

/** Legacy login route — AWS SSO is the only auth entry point. */
export default function LoginPage() {
  redirect("/sso");
}
