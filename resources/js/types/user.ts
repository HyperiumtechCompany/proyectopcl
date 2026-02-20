export type UserPlan = 'free' | 'mensual' | 'anual' | 'lifetime';
export type UserStatus = 'active' | 'inactive' | 'blocked';

export type Role = {
    id: number;
    name: string;
    guard_name: string;
};

export type Permission = {
    id: number;
    name: string;
    guard_name: string;
};

export type UserExtended = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    dni: string | null;
    position: string | null;
    plan: UserPlan;
    plan_expires_at: string | null;
    status: UserStatus;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    roles: Role[];
    roles_list: string[];
    permissions?: Permission[];
    [key: string]: unknown;
};

export type PaginatedData<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
};

export type UserFilters = {
    search?: string;
    role?: string;
    plan?: UserPlan | '';
    status?: UserStatus | '';
};
