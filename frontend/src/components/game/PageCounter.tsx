interface PageCounterProps {
    pageNum: string;
    totalPages: string;
    className?: string;
    /** Shown above the numbers, e.g. "Submitted" */
    caption?: string;
}

export default function PageCounter({ pageNum, totalPages, className = '', caption }: PageCounterProps) {
    return (
        <div className={`flex flex-col items-center gap-0.5 text-center ${className}`}>
            {caption ? (
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-mode-text-2">
                    {caption}
                </span>
            ) : null}
            <div className="flex flex-row">
                {pageNum} / {totalPages}
            </div>
        </div>
    );
}

