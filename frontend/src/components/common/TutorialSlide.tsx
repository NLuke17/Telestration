interface TutorialSlideProps{
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
    imageAlt = "Slide image" 
}: TutorialSlideProps) {
    return (
        <div className="flex-shrink-0 w-full h-[350px] flex flex-col items-center max-w-sm bg-white rounded-lg overflow-hidden p-2 text-center">
            
            {/* Text Content Section */}
            <div className="px-4 pt-2 pb-0">
                <span className="text-xs font-bold uppercase tracking-widest text-dark-grey">
                    {heading}
                </span>
                <h3 className="mt-2 text-xl font-bold text-grey leading-tight">
                    {title}
                </h3>
                <p className="mt-3 text-dark-grey text-sm leading-relaxed">
                    {subtitle}
                </p>
            </div>

            {/* Image Section */}
            <div className="w-3/4 flex justify-center">
                <img 
                    src={imageSrc} 
                    alt={imageAlt} 
                    className="full object-cover"
                />
            </div>
        </div>
    );
}