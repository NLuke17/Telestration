import TutorialSlideshow from './TutorialSlideshow';
import TutorialSlide from './TutorialSlide';
import { TutorialEmbeddedContext } from './tutorialLayoutContext';

import slide1 from '../../assets/slide1.jpg';
import slide2 from '../../assets/slide2.jpg';
import slide3 from '../../assets/slide3.jpg';
import slide4 from '../../assets/slide4.jpg';
import slide5 from '../../assets/slide5.jpg';
import slide6 from '../../assets/slide6.jpg';
import slide7 from '../../assets/slide7.jpg';

interface TutorialProps {
    width?: string;
    /** Fill parent height; tighter dots/chrome for lobby-style panels. */
    embedded?: boolean;
}

export default function Tutorial({ width = 'w-full', embedded = false }: TutorialProps) {
    const outer = embedded
        ? `${width} h-full min-h-0 border-0 bg-transparent shadow-none`
        : `${width} rounded-xl border-2 border-light-grey bg-white`;

    return (
        <TutorialEmbeddedContext.Provider value={embedded}>
            <TutorialSlideshow embedded={embedded} className={outer}>
                <TutorialSlide
                    heading="how to play"
                    title="GET YOUR FRIENDS TOGETHER!"
                    subtitle=""
                    imageSrc={slide1}
                    imageAlt="Drawn image of Sputnik."
                />

                <TutorialSlide
                    heading="how to play"
                    title="TIME TO PROMPT!"
                    subtitle="each person must write a STELLAR sentence"
                    imageSrc={slide2}
                    imageAlt="Drawn image of a rocket blasting off."
                />

                <TutorialSlide
                    heading="how to play"
                    title="TIME TO DRAW!"
                    subtitle="you're going to to get an OTHERWORLDLY sentence"
                    imageSrc={slide3}
                    imageAlt="Drawn image of Saturn."
                />

                <TutorialSlide
                    heading="how to play"
                    title="WHAT IS IT?"
                    subtitle="try to describe one of the LUNATIC drawings"
                    imageSrc={slide4}
                    imageAlt="Drawn image of the moon."
                />

                <TutorialSlide
                    heading="how to play"
                    title="WATCH WHAT HAPPENED!"
                    subtitle="see the ASTRONOMICAL results"
                    imageSrc={slide5}
                    imageAlt="Drawn image of a TV with a rocketship blasting off."
                />

                <TutorialSlide
                    heading="how to play"
                    title="VOTE!"
                    subtitle="like your favorite INTERGALACTIC masterpiece"
                    imageSrc={slide6}
                    imageAlt="Drawn image of stars."
                />

                <TutorialSlide
                    heading="how to play"
                    title="SHARE WHAT HAPPENED!"
                    subtitle=""
                    imageSrc={slide7}
                    imageAlt="Drawn image of Sputnik with satellite waves."
                />
            </TutorialSlideshow>
        </TutorialEmbeddedContext.Provider>
    );
}
