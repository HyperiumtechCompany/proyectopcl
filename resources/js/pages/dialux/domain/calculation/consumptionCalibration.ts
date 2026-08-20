export function calculateAnnualConsumption(
    powerWatts: number,
    dailyOperatingHours: number,
): number {
    if (!Number.isFinite(powerWatts) || !Number.isFinite(dailyOperatingHours)) {
        return 0;
    }

    return (
        (Math.max(0, powerWatts) *
            Math.min(24, Math.max(0, dailyOperatingHours)) *
            365) /
        1000
    );
}
