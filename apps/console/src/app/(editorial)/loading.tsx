import { DeskLoading } from '@/components/ui';

/**
 * Streamed the instant a link in this shell is clicked.
 *
 * Every page here fetches on the server before it renders, and without
 * this the App Router keeps the *previous* page on screen for the whole
 * round trip — so the click looks ignored and gets repeated.
 */
export default function Loading() {
  return <DeskLoading />;
}
