export function FormulaPolinomica({}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Acu Panel</label>
                <input
                    type="text"
                    name="acu_panel"
                    id="acu_panel"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
            </div>
        </div>
    );
}