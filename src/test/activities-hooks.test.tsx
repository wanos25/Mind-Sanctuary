import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/ui/CompletionBurst', () => ({
  default: () => null,
}));

vi.mock('@/components/activities/runners/CBTFlow', () => ({
  default: () => React.createElement('div', { 'data-testid': 'cbt-runner' }),
}));
vi.mock('@/components/activities/runners/ImageInterpretation', () => ({
  default: () => React.createElement('div', { 'data-testid': 'image-runner' }),
}));
vi.mock('@/components/activities/runners/EducationalVideo', () => ({
  default: () => React.createElement('div', { 'data-testid': 'video-runner' }),
}));
vi.mock('@/components/activities/runners/SpotDifference', () => ({
  default: () => React.createElement('div', { 'data-testid': 'spot-runner' }),
}));

vi.mock('@/lib/activities/assets', () => ({
  listPublishedAssets: vi.fn().mockResolvedValue([
    {
      id: 'a1',
      kind: 'cbt_flow',
      title: 'Test CBT',
      description: 'd',
      content: { prompt: 'p', steps: [{ id: 's1', question: 'Q?' }] },
      locale: 'en',
      published: true,
      archived: false,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]),
}));

vi.mock('@/lib/activities/sessions', () => ({
  startActivitySession: vi.fn().mockResolvedValue({ id: 'sess-1' }),
  completeActivitySession: vi.fn(),
}));

import ActivitiesHub from '@/components/activities/ActivitiesHub';
import { startActivitySession } from '@/lib/activities/sessions';

describe('ActivitiesHub hooks order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a lazy runner after start without React hooks violation', async () => {
    const { findByText, findByTestId } = render(React.createElement(ActivitiesHub));

    const startBtn = await waitFor(() => findByText('activities.start'));
    fireEvent.click(startBtn);

    expect(startActivitySession).toHaveBeenCalled();
    expect(await findByTestId('cbt-runner')).toBeInTheDocument();
  });
});
