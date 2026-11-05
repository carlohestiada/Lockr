export type UserPreferences = {
    theme: 'system' | 'light' | 'dark';
    accent_color: string;
    font_size: 'small' | 'medium' | 'large';
    show_website_icons: boolean;
    auto_lock_minutes: number;
};

export type PreferenceTabProps = {
    value: UserPreferences;
    onChange: (field: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) => void;
};

declare global {
    interface WindowEventMap {
        'preferences:updated': CustomEvent<UserPreferences>;
    }
}
