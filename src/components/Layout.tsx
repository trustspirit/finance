import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  isStaff,
  canAccessDashboard,
  canManageUsers,
  canAccessReceipts,
  canAccessSettlementRead,
} from "../lib/roles";
import ProjectSelector from "./ProjectSelector";
import { GearIcon, CloseIcon, MenuIcon, ChevronDownIcon } from "./Icons";

interface NavItem {
  to: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavDropdown({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (path: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasActive = group.items.some((item) => isActive(item.to));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-0.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
          hasActive
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        {group.label}
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(item.to)
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { appUser, logout } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = appUser?.role || "user";
  const userName = appUser?.displayName || appUser?.name || appUser?.email;

  const isActive = (path: string) => location.pathname === path;

  const userItems: NavItem[] = [
    { to: "/request/new", label: t("nav.newRequest") },
    { to: "/my-requests", label: t("nav.myRequests") },
  ];

  const adminSingleItems: NavItem[] = [
    ...(isStaff(role)
      ? [{ to: "/admin/requests", label: t("nav.adminRequests") }]
      : []),
    ...(canAccessSettlementRead(role)
      ? [{ to: "/admin/settlements", label: t("nav.settlements") }]
      : []),
    ...(canAccessDashboard(role)
      ? [{ to: "/admin/dashboard", label: t("nav.dashboard") }]
      : []),
  ];

  const managementGroup: NavGroup | null =
    canAccessReceipts(role) || canManageUsers(role)
      ? {
          label: t("nav.management"),
          items: [
            ...(canAccessReceipts(role)
              ? [{ to: "/admin/receipts", label: t("nav.receipts") }]
              : []),
            ...(canManageUsers(role)
              ? [{ to: "/admin/users", label: t("nav.userManagement") }]
              : []),
          ],
        }
      : null;

  // Mobile: flat list
  const mobileUserItems: NavItem[] = [
    { to: "/request/new", label: t("nav.newRequest") },
    { to: "/my-requests", label: t("nav.myRequests") },
  ];

  const mobileAdminItems: NavItem[] = [
    ...(isStaff(role)
      ? [{ to: "/admin/requests", label: t("nav.adminRequests") }]
      : []),
    ...(canAccessSettlementRead(role)
      ? [{ to: "/admin/settlements", label: t("nav.settlements") }]
      : []),
    ...(canAccessReceipts(role)
      ? [{ to: "/admin/receipts", label: t("nav.receipts") }]
      : []),
    ...(canAccessDashboard(role)
      ? [{ to: "/admin/dashboard", label: t("nav.dashboard") }]
      : []),
    ...(canManageUsers(role)
      ? [{ to: "/admin/users", label: t("nav.userManagement") }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/my-requests" className="font-bold text-lg">
                {t("app.title")}
              </Link>
              <ProjectSelector />
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {userItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                    isActive(item.to)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {adminSingleItems.length > 0 && (
                <>
                  <span className="mx-1 text-gray-300">|</span>
                  {adminSingleItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                        isActive(item.to)
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
              {managementGroup && (
                <NavDropdown group={managementGroup} isActive={isActive} />
              )}
            </div>

            {/* Desktop Right */}
            <div className="hidden lg:flex items-center gap-3">
              <span className="text-sm text-gray-700">
                {userName}
                {role !== "user" && (
                  <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    {t(`role.${role}`)}
                  </span>
                )}
              </span>
              <Link
                to="/settings"
                aria-label={t("nav.settings")}
                className={`p-2 rounded-md transition-colors ${isActive("/settings") ? "bg-gray-100" : "hover:bg-gray-100"}`}
              >
                <GearIcon className="w-4 h-4 text-gray-500" />
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("nav.logout")}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <CloseIcon className="w-5 h-5" />
              ) : (
                <MenuIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-100 py-2">
              <div className="px-3 py-2">
                <ProjectSelector />
              </div>
              <p className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wider">
                {t("nav.requests")}
              </p>
              {mobileUserItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm ${
                    isActive(item.to)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {mobileAdminItems.length > 0 && (
                <>
                  <p className="px-3 py-1 mt-2 text-xs text-gray-400 uppercase tracking-wider">
                    {t("nav.management")}
                  </p>
                  {mobileAdminItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2.5 rounded-md text-sm ${
                        isActive(item.to)
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <Link
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
                >
                  {t("nav.settings")}
                </Link>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {userName}
                    {role !== "user" && (
                      <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {t(`role.${role}`)}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6 mt-14">{children}</main>
    </div>
  );
}
