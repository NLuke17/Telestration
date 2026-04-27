import { useTutorialEmbedded } from './tutorialLayoutContext';

interface TutorialSlideProps {
    heading: string;
    title: string;
    subtitle: string;
    imageSrc: string;
    imageAlt?: string;
}

export default function TutorialSlide({
    heading,
    title,
    subtitle,
    imageSrc,
    imageAlt = 'Slide image',
}: TutorialSlideProps) {
    const embedded = useTutorialEmbedded();

    // added dark:bg-brand-charcoal, to deal with change to dark mode
    const shell = embedded
        ? 'flex h-full max-h-full min-h-0 w-full flex-shrink-0 flex-col items-center overflow-hidden bg-white dark:bg-black p-1 text-center'
        : 'flex h-[350px] w-full max-w-sm flex-shrink-0 flex-col items-center overflow-hidden rounded-lg bg-white dark:bg-black p-2 text-center';

    const textBlock = embedded ? 'px-2 pb-0 pt-0' : 'px-4 pb-0 pt-2';

    // added dark mode text colors 
    const titleClass = embedded 
        ? 'mt-1 text-base font-bold leading-tight text-grey dark:text-dark-mode-text-1' 
        : 'mt-2 text-xl font-bold leading-tight text-grey dark:text-dark-mode-text-1';

    const subtitleClass = embedded 
        ? 'mt-1 text-xs leading-snug text-dark-grey dark:text-dark-mode-text-2' 
        : 'mt-3 text-sm leading-relaxed text-dark-grey dark:text-dark-mode-text-2';

    return (
        <div className={shell}>
            <div className={textBlock}>
                {/* updated the heading color for dark mode */}
                <span className="text-[10px] font-bold uppercase tracking-widest text-dark-grey dark:text-mid-grey">
                    {heading}
                </span>
                <h3 className={titleClass}>{title}</h3>
                {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
            </div>

            <div className={`flex min-h-0 flex-1 justify-center ${embedded ? 'w-full px-1' : 'w-3/4'}`}>
                {/* added dark:invert to flip the images */}
                <img 
                    src={imageSrc} 
                    alt={imageAlt} 
                    className="max-h-full w-full object-contain transition-all duration-300 dark:invert" 
                />
            </div>
        </div>
    );
}