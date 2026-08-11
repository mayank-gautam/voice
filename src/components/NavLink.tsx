"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkProps extends Omit<React.ComponentPropsWithoutRef<typeof Link>, "className"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string | undefined);
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, pendingClassName, href, ...props }, ref) => {
    const pathname = usePathname();
    const hrefPath = typeof href === "string" ? href : href.pathname ?? "";
    const isActive = pathname === hrefPath || (hrefPath !== "/" && pathname.startsWith(hrefPath));

    const resolvedClassName =
      typeof className === "function"
        ? className({ isActive, isPending: false })
        : cn(className, isActive && activeClassName, pendingClassName);

    return <Link ref={ref} href={href} className={resolvedClassName} {...props} />;
  }
);

NavLink.displayName = "NavLink";

export { NavLink };
