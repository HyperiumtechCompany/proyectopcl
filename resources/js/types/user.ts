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

export type OrganizationPlan = 'negocios' | 'empresarial';

export type Organization = {
    id: number;
    nombre: string;
    plan: OrganizationPlan;
    owner_id: number | null;
    users_count?: number;
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
    organization_id: number | null;
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

export type PlanRequestPlan = 'free' | 'mensual' | 'anual' | 'negocios' | 'empresarial';
export type PlanRequestStatus = 'pending' | 'approved' | 'rejected';

export type PlanRequest = {
    id: number;
    nombre: string;
    email: string;
    plan: PlanRequestPlan;
    empresa: string | null;
    comprobante_path: string | null;
    status: PlanRequestStatus;
    notas_admin: string | null;
    user_id: number | null;
    created_at: string;
};
