import TutorialSlideshow from "./TutorialSlideshow"
import TutorialSlide from "./TutorialSlide"

interface TutorialProps {
    width?: string; 
}

export default function Tutorial({ width = "w-full" }: TutorialProps) {
    return (
        <TutorialSlideshow className={`${width} bg-white rounded-xl border-2 border-light-grey bottom-1/15`}>

            {/* Slide 1 */}
            <TutorialSlide 
            heading="how to play"
            title="GET YOUR FRIENDS TOGETHER!"
            subtitle=""
            imageSrc='../../src/assets/slide1.jpg'
            imageAlt='Drawn image of Sputnik.'
            />

            {/* Slide 2 */}
            <TutorialSlide 
            heading='how to play'
            title='TIME TO PROMPT!'
            subtitle='each person must write a STELLAR sentence'
            imageSrc='../../src/assets/slide2.jpg'
            imageAlt='Drawn image of a rocket blasting off.'
            />

            {/* Slide 3 */}
            <TutorialSlide 
            heading='how to play'
            title='TIME TO DRAW!'
            subtitle="you're going to to get an OTHERWORLDLY sentence"
            imageSrc='../../src/assets/slide3.jpg'
            imageAlt='Drawn image of Saturn.'
            />

            {/* Slide 4 */}
            <TutorialSlide 
            heading='how to play'
            title='WHAT IS IT?'
            subtitle="try to describe one of the LUNATIC drawings"
            imageSrc='../../src/assets/slide4.jpg'
            imageAlt='Drawn image of the moon.'
            />

            {/* Slide 5 */}
            <TutorialSlide 
            heading='how to play'
            title='WATCH WHAT HAPPENED!'
            subtitle="see the ASTRONOMICAL results"
            imageSrc='../../src/assets/slide5.jpg'
            imageAlt='Drawn image of a TV with a rocketship blasting off.'
            />

            {/* Slide 6 */}
            <TutorialSlide 
            heading='how to play'
            title='VOTE!'
            subtitle="like your favorite INTERGALACTIC masterpiece"
            imageSrc='../../src/assets/slide6.jpg'
            imageAlt='Drawn image of stars.'
            />

            {/* Slide 7 */}
            <TutorialSlide 
            heading='how to play'
            title='SHARE WHAT HAPPENED!'
            subtitle=""
            imageSrc='../../src/assets/slide7.jpg'
            imageAlt='Drawn image of Sputnik with satellite waves.'
            />

        </TutorialSlideshow>
    )
}