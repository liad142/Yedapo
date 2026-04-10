import { redirect } from 'next/navigation';

// Settings is organized into tabs under /settings/{profile,notifications,connections,billing}.
// Profile is the default landing tab.
export default function SettingsPage() {
  redirect('/settings/profile');
}
