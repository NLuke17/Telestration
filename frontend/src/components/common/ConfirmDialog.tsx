import { useEffect } from 'react';

export type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    /** When true, confirm button uses danger styling hints via className on the wrapper */
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

/**
 * In-app confirm instead of window.confirm — required for reliable behavior on iOS Safari
 * (native dialogs are often blocked after async work or in standalone/PWA contexts).
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancel',
    danger,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                className="w-full max-w-md rounded-lg border-2 border-dark-grey bg-white p-6 shadow-xl dark:border-dark-mode-border dark:bg-slate-950"
            >
                <h2 id="confirm-dialog-title" className="text-heading-3 text-light-mode-text-1 dark:text-dark-mode-text-1">
                    {title}
                </h2>
                <p className="mt-3 text-body text-gray-700 dark:text-dark-mode-text-2">{message}</p>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex cursor-pointer justify-center rounded-md border border-dark-grey bg-white px-6 py-2 font-semibold text-brand-charcoal shadow-sm hover:bg-gray-50 dark:border-dark-mode-border dark:bg-slate-900 dark:text-dark-mode-text-1 dark:hover:bg-slate-800"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={
                            danger
                                ? 'inline-flex cursor-pointer justify-center rounded-md border border-red-500 bg-red-700 px-6 py-2 font-semibold text-white shadow-sm hover:bg-red-800'
                                : 'inline-flex cursor-pointer justify-center rounded-md border border-transparent bg-brand-charcoal px-6 py-2 font-semibold text-white shadow-sm hover:opacity-90 dark:bg-dark-mode-button-background dark:border-dark-mode-border-2'
                        }
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
