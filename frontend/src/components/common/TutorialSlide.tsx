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

    const shell = embedded
        ? 'flex h-full max-h-full min-h-0 w-full flex-shrink-0 flex-col items-center overflow-hidden bg-white p-1 text-center'
        : 'flex h-[350px] w-full max-w-sm flex-shrink-0 flex-col items-center overflow-hidden rounded-lg bg-white p-2 text-center';

    const textBlock = embedded ? 'px-2 pb-0 pt-0' : 'px-4 pb-0 pt-2';

    const titleClass = embedded ? 'mt-1 text-base font-bold leading-tight text-grey' : 'mt-2 text-xl font-bold leading-tight text-grey';

    const subtitleClass = embedded ? 'mt-1 text-xs leading-snug text-dark-grey' : 'mt-3 text-sm leading-relaxed text-dark-grey';

    return (
        <div className={shell}>
            <div className={textBlock}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-dark-grey">{heading}</span>
                <h3 className={titleClass}>{title}</h3>
                {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
            </div>

            <div className={`flex min-h-0 flex-1 justify-center ${embedded ? 'w-full px-1' : 'w-3/4'}`}>
                <img src={imageSrc} alt={imageAlt} className="max-h-full w-full object-contain" />
            </div>
        </div>
    );
}
