"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  href: string;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
}>;

function normalizePath(path: string) {
  const q = path.indexOf("?");
  const p = q >= 0 ? path.slice(0, q) : path;
  return p.endsWith("/") && p !== "/" ? p.slice(0, -1) : p;
}

export default function NavLink({
  href,
  children,
  exact = false,
  className = "px-3 py-2 rounded-md font-medium",
  activeClassName = "bg-[#a4825f] text-white",
}: Props) {
  const pathname = usePathname();

  const current = normalizePath(pathname ?? "");
  const target = normalizePath(href);
  const isActive = exact
    ? current === target
    : current === target || current.startsWith(`${target}/`);

  return (
    <Link
      href={href}
      className={`${className} ${isActive ? activeClassName : "text-[#333]"}`}
    >
      {children}
    </Link>
  );
}