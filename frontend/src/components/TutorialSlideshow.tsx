interface TutorialSlideshowProps {
    className?: string;
}

export default function TutorialSlideshow({className=''}: TutorialSlideshowProps) {
    return (
        <div className={` ${className} h-full w-auto min-w-[200px] border-2 border-light-grey rounded-lg flex items-center text-center`}>
            Placeholder for Tutorial Slideshow
        </div>
    );
}