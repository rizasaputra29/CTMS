'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
    id: string;
    title: string;
    description: string;
}

interface PeriodStepperProps {
    steps: Step[];
    currentStep: number;
    onStepClick?: (index: number) => void;
}

export function PeriodStepper({ steps, currentStep, onStepClick }: PeriodStepperProps) {
    return (
        <div className="w-full">
            <div className="flex items-start justify-between">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isPending = index > currentStep;
                    const isClickable = onStepClick && (isCompleted || index <= currentStep + 1);

                    return (
                        <div key={step.id} className="flex flex-1 items-start">
                            {/* Step Circle and Info */}
                            <div className="flex flex-col items-center flex-1">
                                {/* Circle */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (isClickable) {
                                            onStepClick?.(index);
                                        }
                                    }}
                                    disabled={!isClickable}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                                        isCompleted && "bg-green-600 text-white",
                                        isCurrent && "bg-blue-600 text-white ring-4 ring-blue-100",
                                        isPending && "bg-gray-100 text-gray-400 border-2 border-gray-200",
                                        isClickable && !isCurrent && "cursor-pointer hover:opacity-80"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="h-5 w-5" />
                                    ) : (
                                        index + 1
                                    )}
                                </button>

                                {/* Title and Description */}
                                <div className="mt-3 text-center">
                                    <p
                                        className={cn(
                                            "text-sm font-semibold",
                                            isCompleted && "text-green-700",
                                            isCurrent && "text-blue-700",
                                            isPending && "text-gray-500"
                                        )}
                                    >
                                        {step.title}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5 max-w-[120px]">
                                        {step.description}
                                    </p>
                                </div>
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="flex-1 pt-5 px-2">
                                    <div
                                        className={cn(
                                            "h-0.5 transition-colors",
                                            isCompleted ? "bg-green-600" : "bg-gray-200"
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
