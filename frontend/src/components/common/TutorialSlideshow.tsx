import React, { useState } from 'react';

interface TutorialSlideshowProps {
    children: React.ReactNode;
    className?: string;
    /** Tighter chrome and height-filling layout for fixed-height panels (e.g. lobby). */
    embedded?: boolean;
}

export default function TutorialSlideshow({ children, className = '', embedded = false }: TutorialSlideshowProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const slides = React.Children.toArray(children);
    const totalSlides = slides.length;

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
    };

    const rootClass = embedded
        ? `relative flex h-full min-h-0 flex-col overflow-hidden ${className}`.trim()
        : `relative overflow-hidden ${className}`.trim();

    const trackClass = embedded
        ? 'flex min-h-0 flex-1 transition-transform duration-500 ease-in-out'
        : 'flex transition-transform duration-500 ease-in-out';

    const slideShellClass = embedded ? 'h-full min-h-0 w-full flex-shrink-0' : 'w-full flex-shrink-0';

    const dotsBottom = embedded ? 'bottom-1.5' : 'bottom-4';

    return (
        <div className={rootClass}>
            <div className={trackClass} style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {slides.map((slide, index) => (
                    <div key={index} className={slideShellClass}>
                        {slide}
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={prevSlide}
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-dark-grey/20 text-white transition-all hover:bg-dark-grey/50"
                aria-label="Previous slide"
            >
                &larr;
            </button>

            <button
                type="button"
                onClick={nextSlide}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-dark-grey/20 text-white transition-all hover:bg-dark-grey/50"
                aria-label="Next slide"
            >
                &rarr;
            </button>

            <div className={`absolute left-1/2 flex -translate-x-1/2 gap-2 ${dotsBottom}`}>
                {slides.map((_, i) => (
                    <button
                        type="button"
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`h-2 w-2 rounded-full transition-all ${
                            i === currentIndex 
                                ? 'w-4 bg-blue-500' 
                                : 'bg-gray-300 dark:bg-dark-grey' // updated for dark mode
                        }`}
                        aria-label={`Go to slide ${i + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}