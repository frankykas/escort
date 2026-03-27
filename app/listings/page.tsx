import { ListingsClient } from "./ListingsClient";

export const metadata = {
  title: "Listings — Cleopatra",
  description: "Browse escort and companion listings by category, city, and availability.",
};

export default function ListingsPage() {
  return <ListingsClient />;
}
