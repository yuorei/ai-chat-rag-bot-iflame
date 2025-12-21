import { redirect } from "react-router";

export function loader() {
  return redirect("/dashboard");
}

export default function Index() {
  return null;
}
