import React from 'react';

interface SubsectionNavProps {
    availableSubsections: Array<{ key: string; label: string }>;
    currentSubsection: string;
    onSubsectionChange: (newSubsection: string) => void;
}

export function SubsectionNav({
    availableSubsections,
    currentSubsection,
    onSubsectionChange,
}: SubsectionNavProps) {
    return (
        <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {availableSubsections.map((sub) => (
                    <button
                        key={sub.key}
                        onClick={() => onSubsectionChange(sub.key)}
                        className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap transition-colors ${currentSubsection === sub.key
                                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
                            } `}
                    >
                        {sub.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
