export interface UserProfile {
  display_name: string | null;
  preferred_genres: string[];
  preferred_country: string;
  onboarding_completed: boolean;
}
