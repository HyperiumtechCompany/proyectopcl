/**
 * Convención de rotación del constructor 3D del editor de módulo.
 *
 * El plano 2D tiene Y hacia abajo y los ángulos horarios en pantalla crecen
 * como `atan2(dy, dx)` (así se miden los muros). `House3DBuilder` coloca cada
 * objeto en (x, z) = (x2D, y2D) — sin voltear ejes —, y en Babylon
 * `mesh.rotation.y = θ` lleva el eje local X a (cos θ, 0, −sin θ). Por eso
 * un ángulo de plano `a` (horario, como `rotate(a)` del SVG y como
 * `atan2(dy, dx)` de un muro) es `rotation.y = −a`.
 *
 * Los muros ya usaban `−atan2(dy, dx)`; las rotaciones manuales de luminarias,
 * interruptores y dispositivos usaban `+grados`, con lo que un objeto rotado
 * 30° en el 2D aparecía a −30° en el 3D (y, sobre un muro, la parte manual
 * giraba al revés que la del muro dentro de la MISMA expresión).
 */

/** `rotation.y` (rad) para un objeto cuyo ángulo de plano, horario, es `degrees`. */
export function planRotationToYaw(degrees: number): number {
    return (-degrees * Math.PI) / 180;
}

/** `rotation.y` (rad) de un objeto pegado a un muro: tangente del muro (`atan2`, rad) + giro manual (grados, horario). */
export function wallSnappedYaw(wallAngleRad: number, manualDegrees: number): number {
    return -wallAngleRad + planRotationToYaw(manualDegrees);
}

/** Dirección de plano (x, y-abajo) hacia la que apunta el eje local X de un objeto con `rotation.y = yaw`. */
export function yawToPlanDirection(yaw: number): { x: number; y: number } {
    // Eje local X → (cos yaw, 0, −sin yaw) en (x, y, z), y z = y del plano.
    return { x: Math.cos(yaw), y: -Math.sin(yaw) };
}
