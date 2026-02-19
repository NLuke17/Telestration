interface PageCounterProps {
    pageNum: string;
    totalPages: string;
    className?: string;
}

export default function PageCounter({ pageNum, totalPages, className='' }: PageCounterProps) {
    return (
        <div className={`flex flex-row text-center${className}`}>
            {pageNum} / {totalPages}
        </div>
    )
}

