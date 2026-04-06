import { redirect } from 'next/navigation';

// Profile content currently lives in /settings (the legacy monolith page).
// This route exists so the tab link works; it redirects to the existing page.
// TODO: migrate profile sections here and make /settings redirect to /settings/profile
export default function ProfilePage() {
  redirect('/settings');
}
