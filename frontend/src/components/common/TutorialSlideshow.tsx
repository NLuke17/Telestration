import React, { useState } from 'react';

interface TutorialSlideshowProps {
  children: React.ReactNode;
  className?: string;
}

export default function TutorialSlideshow({ children, className }: TutorialSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const slides = React.Children.toArray(children);
  const totalSlides = slides.length;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Moving Track */}
      <div 
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={index} className="w-full flex-shrink-0">
            {slide}
          </div>
        ))}
      </div>

      {/* Arrows */}
      <button 
        onClick={prevSlide}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-dark-grey/20 hover:bg-dark-grey/40 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all"
      >
        &larr;
      </button>
      
      <button 
        onClick={nextSlide}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-dark-grey/20 hover:bg-dark-grey/40 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all"
      >
        &rarr;
      </button>

      {/* What slide is the user on */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-2 w-2 rounded-full transition-all ${
              i === currentIndex ? 'bg-blue-500 w-4' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
