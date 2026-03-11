interface TimerDisplayProps {
    minutesLeft?: string;
    secondsLeft: string;
    className?: string;
}

export default function TimerDisplay({ minutesLeft='00', secondsLeft, className=''}: TimerDisplayProps) {
    return (
        <div className={`${className}`}>
            {minutesLeft}:{secondsLeft}
        </div>
    );
};