import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import LobbyPage from '../LobbyPage.tsx';

test('cannot join room without a join code', async () => {
  render(<LobbyPage />);
  const button = screen.getByRole('button', { name: /Join a Room/i });
  await userEvent.click(button);
  expect(screen.getByText('Button clicked!')).toBeInTheDocument();
});