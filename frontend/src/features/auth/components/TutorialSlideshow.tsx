interface TutorialSlideshowProps {
    className?: string;
}

export default function TutorialSlideshow({className=''}: TutorialSlideshowProps) {
    return (
        <div
            className={`flex h-full min-h-[120px] w-full min-w-0 flex-col items-center justify-center border-2 border-light-grey text-center ${className}`.trim()}
        >
            Placeholder for Tutorial Slideshow
        </div>
    );
}
