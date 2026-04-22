import { createContext, useContext } from 'react';

export const TutorialEmbeddedContext = createContext(false);

export function useTutorialEmbedded(): boolean {
    return useContext(TutorialEmbeddedContext);
}
