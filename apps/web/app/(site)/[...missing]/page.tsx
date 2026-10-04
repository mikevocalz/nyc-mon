import { notFound } from 'next/navigation';

// Unmatched URLs render (site)/not-found.tsx inside the site chrome instead of
// Next's bare default 404: the route groups have no root-level layout to hold it.
export default function MissingPage() {
  notFound();
}
