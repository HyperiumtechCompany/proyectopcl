import axios from 'axios';
import type { Fixture } from '@/pages/dialux/hooks/useEditorStore';
import * as productRoutes from '@/routes/dialux/products';

/**
 * Adaptador API del catálogo de luminarias importadas (Fase 2 del plan
 * maestro, §7.3/§12.3: "Adaptadores API traducen DTO ↔ dominio" y "Wayfinder
 * centraliza rutas backend — no usar URLs literales en componentes nuevos").
 * Extraído de `components/CatalogPanel.tsx` sin cambiar ningún endpoint ni
 * comportamiento de red.
 */

export interface ImportedLuminaireProduct {
    id: number;
    name: string;
    manufacturer: string | null;
    catalog_number: string | null;
    source_format: 'ies' | 'ldt' | 'gldf' | 'manual';
    total_lumens: number | null;
    power_watts: number | null;
    cct: string | null;
    cri_ra?: number | null;
    beam_angle_50?: number | null;
    fixture_type: string | null;
    fixture_shape: string | null;
    efficiency: number | null;
    product_image_url?: string | null;
    brand_logo_url?: string | null;
    /** true si el propio usuario la compartió (is_global en backend) — visible para todos */
    is_global?: boolean;
    /** true si el producto pertenece al usuario autenticado (puede compartirla/eliminarla) */
    is_owner?: boolean;
    report_data?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
    } | null;
    report_assets?: {
        polar_svg?: string | null;
    } | null;
    dimensions?: { length: number; width: number; height: number; radius?: number } | null;
}

export type PhotometricWeb = NonNullable<Fixture['photometricWeb']>;

export interface ManualLuminairePayload {
    name: string;
    manufacturer?: string;
    catalog_number?: string;
    total_lumens: number;
    power_watts?: number;
    cct?: string;
    cri_ra?: number;
    beam_angle_50?: number;
    photometric_table?: Array<{ gamma: number; candela: number }>;
    fixture_type?: string;
    fixture_shape?: string;
    /** radius solo aplica cuando fixture_shape es 'round'/'cylindrical'. */
    dimensions?: { length?: number; width?: number; height?: number; radius?: number };
}

/** Mensaje de error legible extraído de una respuesta de validación de Laravel (422) o de un mensaje genérico. */
export function extractErrorMessage(error: unknown, fallback: string): string {
    const axiosError = error as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
    };
    const firstValidationMessage = axiosError.response?.data?.errors
        ? Object.values(axiosError.response.data.errors).flat()[0]
        : null;

    return firstValidationMessage ?? axiosError.response?.data?.message ?? fallback;
}

const getCsrfToken = (): string =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

const getXsrfToken = (): string => {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
};

const getCsrfHeaders = (): Record<string, string> => {
    const xsrfToken = getXsrfToken();
    if (xsrfToken) {
        return { 'X-XSRF-TOKEN': xsrfToken, 'X-Requested-With': 'XMLHttpRequest' };
    }
    return { 'X-CSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' };
};

const jsonRequestConfig = { headers: { Accept: 'application/json', ...getCsrfHeaders() }, withCredentials: true };

export async function fetchImportedProducts(): Promise<ImportedLuminaireProduct[]> {
    const response = await axios.get<{ products: ImportedLuminaireProduct[] }>(productRoutes.index.url());
    return response.data.products ?? [];
}

export async function shareProduct(productId: number, isGlobal: boolean): Promise<ImportedLuminaireProduct> {
    const response = await axios.patch<{ product: ImportedLuminaireProduct }>(
        productRoutes.share(productId).url,
        { is_global: isGlobal },
        jsonRequestConfig,
    );
    return response.data.product;
}

export async function deleteProduct(productId: number): Promise<void> {
    await axios.delete(productRoutes.destroy(productId).url, jsonRequestConfig);
}

export async function fetchPhotometricWeb(productId: number): Promise<PhotometricWeb | null> {
    const response = await axios.get<{ product: ImportedLuminaireProduct & { photometric_web?: PhotometricWeb | null } }>(
        productRoutes.show({ productId }).url,
    );
    return response.data.product.photometric_web ?? null;
}

export async function importPhotometryFile(
    formData: FormData,
): Promise<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }> {
    const response = await axios.post<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }>(
        productRoutes.importMethod.url(),
        formData,
        jsonRequestConfig,
    );
    return response.data;
}

export async function createManualLuminaire(
    payload: ManualLuminairePayload | FormData,
): Promise<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }> {
    if (payload instanceof FormData) {
        const response = await axios.post<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }>(
            productRoutes.storeManual.url(),
            payload,
            { ...jsonRequestConfig, headers: { ...jsonRequestConfig.headers, 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    }

    const response = await axios.post<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }>(
        productRoutes.storeManual.url(),
        payload,
        jsonRequestConfig,
    );
    return response.data;
}

export async function updateLuminaire(
    productId: number,
    payload: Omit<ManualLuminairePayload, 'beam_angle_50' | 'photometric_table'> | FormData,
): Promise<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }> {
    if (payload instanceof FormData) {
        payload.append('_method', 'PATCH');
        const response = await axios.post<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }>(
            productRoutes.update(productId).url,
            payload,
            { ...jsonRequestConfig, headers: { ...jsonRequestConfig.headers, 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    }

    const response = await axios.patch<{ product: ImportedLuminaireProduct; message?: string; warnings?: string[] }>(
        productRoutes.update(productId).url,
        payload,
        jsonRequestConfig,
    );
    return response.data;
}
