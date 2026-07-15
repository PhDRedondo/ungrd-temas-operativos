import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Briefcase,
  Building2,
  Cog,
  Droplets,
  FileSignature,
  HardHat,
  HeartHandshake,
  Home,
  Landmark,
  LineChart,
  Package,
  Route,
  ShoppingCart,
  Siren,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  droplets: Droplets,
  truck: Truck,
  "hard-hat": HardHat,
  bridge: Route,
  cog: Cog,
  landmark: Landmark,
  "heart-handshake": HeartHandshake,
  briefcase: Briefcase,
  home: Home,
  "bell-ring": BellRing,
  wrench: Wrench,
  users: Users,
  "shopping-cart": ShoppingCart,
  "building-2": Building2,
  "file-signature": FileSignature,
  wallet: Wallet,
  "line-chart": LineChart,
  package: Package,
  siren: Siren,
};

export function ThemeIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = MAP[name] ?? Package;
  return <Icon className={className} aria-hidden />;
}
