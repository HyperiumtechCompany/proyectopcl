import { Form } from '@inertiajs/react';
import {
    destroy,
    store,
} from '@/actions/App/Http/Controllers/Cuaderno/CuadernoVinculoController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface LinkData {
    id: number;
    estado: string;
    entidad: string | null;
    obra: string | null;
    contrato: string | null;
    codigo_cui: string | null;
    rol: string | null;
    external_id: string | null;
}

const fields = [
    {
        name: 'entidad',
        label: 'Entidad contratante',
        required: true,
        maxLength: 255,
    },
    {
        name: 'contrato',
        label: 'Contrato o expediente',
        required: false,
        maxLength: 255,
    },
    { name: 'codigo_cui', label: 'Código CUI', required: false, maxLength: 50 },
    {
        name: 'external_id',
        label: 'Identificador oficial del cuaderno (opcional)',
        required: false,
        maxLength: 120,
    },
] as const;

/** Fallback when the connector cannot be used: link metadata typed by hand. */
export default function ManualLinkForm({
    projectId,
    projectCui,
    vinculo,
    roles,
}: {
    projectId: number;
    projectCui: string | null;
    vinculo: LinkData | null;
    roles: string[];
}) {
    return (
        <div className="space-y-6">
            <Form
                {...store.form(projectId)}
                key={
                    vinculo
                        ? `${vinculo.id}:${vinculo.estado}:${vinculo.entidad}:${vinculo.obra}`
                        : 'new'
                }
            >
                {({ errors, processing }) => (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Úsalo solo si no puedes conectar la cuenta. Guardar
                            crea una vinculación nueva pendiente de verificar
                            {vinculo ? ' y archiva la actual' : ''}.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {fields.map((field) => (
                                <div key={field.name} className="space-y-2">
                                    <Label htmlFor={field.name}>
                                        {field.label}
                                    </Label>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        required={field.required}
                                        maxLength={field.maxLength}
                                        defaultValue={
                                            vinculo?.[field.name] ??
                                            (field.name === 'codigo_cui'
                                                ? projectCui
                                                : '') ??
                                            ''
                                        }
                                        aria-invalid={Boolean(
                                            errors[field.name],
                                        )}
                                    />
                                    {errors[field.name] && (
                                        <p
                                            role="alert"
                                            className="text-sm text-red-600"
                                        >
                                            {errors[field.name]}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="obra">Obra o prestación</Label>
                            <textarea
                                id="obra"
                                name="obra"
                                required
                                maxLength={3000}
                                defaultValue={vinculo?.obra ?? ''}
                                rows={3}
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                aria-invalid={Boolean(errors.obra)}
                            />
                            {errors.obra && (
                                <p
                                    role="alert"
                                    className="text-sm text-red-600"
                                >
                                    {errors.obra}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rol">Tu rol en el cuaderno</Label>
                            <select
                                id="rol"
                                name="rol"
                                required
                                defaultValue={vinculo?.rol ?? ''}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                aria-invalid={Boolean(errors.rol)}
                            >
                                <option value="" disabled>
                                    Selecciona tu rol
                                </option>
                                {roles.map((rol) => (
                                    <option key={rol} value={rol}>
                                        {rol}
                                    </option>
                                ))}
                            </select>
                            {errors.rol && (
                                <p
                                    role="alert"
                                    className="text-sm text-red-600"
                                >
                                    {errors.rol}
                                </p>
                            )}
                        </div>
                        <label className="flex items-start gap-3 text-sm">
                            <input
                                type="checkbox"
                                name="confirmacion"
                                value="1"
                                required
                                className="mt-1"
                            />
                            Confirmo que estos datos corresponden al cuaderno de
                            este proyecto.
                        </label>
                        {errors.confirmacion && (
                            <p role="alert" className="text-sm text-red-600">
                                {errors.confirmacion}
                            </p>
                        )}
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={processing}
                        >
                            {processing
                                ? 'Guardando…'
                                : 'Guardar datos manuales'}
                        </Button>
                    </div>
                )}
            </Form>
            {vinculo && (
                <Form {...destroy.form(projectId)} className="border-t pt-5">
                    {({ processing }) => (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Archivar conserva los asientos en el historial y
                                permite vincular otro cuaderno. Desconecta la
                                cuenta antes.
                            </p>
                            <label className="flex items-center gap-3 text-sm">
                                <input type="checkbox" required /> Confirmo que
                                quiero archivar esta vinculación.
                            </label>
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={processing}
                            >
                                Archivar vinculación
                            </Button>
                        </div>
                    )}
                </Form>
            )}
        </div>
    );
}
