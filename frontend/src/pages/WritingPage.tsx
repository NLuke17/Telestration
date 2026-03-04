import React from 'react';
import Container from '../components/Container';
import InputField from '../components/InputField';
import Button from '../components/Button';
import { useState } from 'react';
import PageCounter from '../components/PageCounter';
import TimerDisplay from '../components/TimerDisplay';

const WritingPage: React.FC = () => {
    const [sentence, setSentence] = useState('');

    return (
        <div className="flex items-center h-screen">
            <Container width='900px' height='500px' padding='5em' className='flex flex-col justify-between items-center border-2 border-dark-grey rounded-lg'>
                <div className='flex w-full justify-between'>
                    <PageCounter pageNum='2' totalPages='4' className='text-heading-3'/>
                    <TimerDisplay minutesLeft='00' secondsLeft='30' className='text-heading-3'/>
                </div>
                <div className="text-heading-1">Write a Sentence</div>
                <div className="flex items-center justify-center w-full">
                    <InputField 
                        id='sentence'
                        label=""
                        placeholder="Type your sentence here!"
                        value={sentence}
                        onChange={setSentence}
                        className='w-full'
                    />
                    <Button 
                        label="Done"
                        disabled={!(sentence.length > 0)}
                    />
                </div>
            </Container>
        </div>
    );
}

export default WritingPage;